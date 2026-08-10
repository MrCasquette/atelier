// Validateur générique du module content (P2b).
//
// Le registre (table `content_definition`) décrit la forme des blocs déclarés par le dev. Ce
// service en dérive, à l'exécution, un validateur par type de section : chaque définition est
// TRADUITE en schéma TypeBox (récursif pour `list`/`repeater`/`component`), puis COMPILÉE une
// fois et mise en cache. C'est le pendant dynamique de l'ancienne union statique de
// `page/model.ts` côté produit.
//
// On n'importe QUE depuis Elysia (`t`) et son type-system (`TypeCompiler`, `FormatRegistry`) :
// même instance TypeBox que tout le reste de l'API → aucune version à maintenir, aucun drift.

import { db } from '@repo/db';
import { type TSchema, t } from 'elysia';
import { FormatRegistry, type TypeCheck, TypeCompiler } from 'elysia/type-system';
import {
  type Registry,
  registrySchema,
  type SerializedDefinition,
  type SerializedField,
} from './definition-model';
import { contentDefinition } from './schema';

// ── Formats (branchés une fois sur l'instance TypeBox d'Elysia) ───────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!FormatRegistry.Has('uuid')) {
  FormatRegistry.Set('uuid', (value) => UUID_RE.test(value));
}
if (!FormatRegistry.Has('date')) {
  FormatRegistry.Set('date', (value) => !Number.isNaN(Date.parse(value)));
}
if (!FormatRegistry.Has('date-time')) {
  FormatRegistry.Set('date-time', (value) => !Number.isNaN(Date.parse(value)));
}

const registryCheck = TypeCompiler.Compile(registrySchema);

// ── Traduction registre → schéma TypeBox ──────────────────────────────────────────────────────
type Components = Registry['components'];

function resolveComponent(name: string, components: Components, seen: Set<string>): TSchema {
  if (seen.has(name)) {
    throw new Error(`Référence circulaire de component : « ${name} » (non supportée en V1).`);
  }
  const def = components[name];
  if (!def) {
    throw new Error(`Component référencé introuvable dans le registre : « ${name} ».`);
  }
  return fieldsToSchema(def.fields, components, new Set(seen).add(name));
}

function fieldToSchema(field: SerializedField, components: Components, seen: Set<string>): TSchema {
  switch (field.kind) {
    case 'text':
      return t.String({
        minLength: field.minLength,
        maxLength: field.maxLength,
        format: field.format,
      });
    case 'richText':
      return t.String();
    case 'number':
      return field.integer
        ? t.Integer({ minimum: field.min, maximum: field.max })
        : t.Number({ minimum: field.min, maximum: field.max });
    case 'boolean':
      return t.Boolean();
    case 'date':
      return t.String({ format: field.time ? 'date-time' : 'date' });
    case 'enum': {
      const one = t.Union(field.options.map((option) => t.Literal(option.value)));
      return field.multiple ? t.Array(one) : one;
    }
    case 'image':
    case 'ref':
      return t.String({ format: 'uuid' }); // existence vérifiée séparément (accès DB)
    case 'component':
      return resolveComponent(field.of, components, seen);
    case 'list':
      return t.Array(resolveComponent(field.of, components, seen), {
        minItems: field.min,
        maxItems: field.max,
      });
    case 'repeater':
      return t.Array(fieldsToSchema(field.fields, components, seen), {
        minItems: field.min,
        maxItems: field.max,
      });
  }
}

function fieldsToSchema(
  fields: Record<string, SerializedField>,
  components: Components,
  seen: Set<string>,
): TSchema {
  const shape: Record<string, TSchema> = {};
  for (const [key, field] of Object.entries(fields)) {
    const schema = fieldToSchema(field, components, seen);
    shape[key] = field.required ? schema : t.Optional(schema);
  }
  return t.Object(shape);
}

const definitionToSchema = (def: SerializedDefinition, components: Components): TSchema =>
  fieldsToSchema(def.fields, components, new Set());

// ── Cache (registre chargé + validateurs compilés par type de section) ────────────────────────
type Cache = { registry: Registry; sectionChecks: Map<string, TypeCheck<TSchema>> };
let cache: Cache | null = null;

// Reconstruit le registre depuis les lignes DB. On revalide contre le schéma (frontière interne :
// le stockage est censé être sain, mais on ne truste pas du jsonb non typé) → type garanti.
function rowsToRegistry(rows: (typeof contentDefinition.$inferSelect)[]): Registry {
  const sections: Record<string, unknown> = {};
  const components: Record<string, unknown> = {};
  for (const row of rows) {
    const def = {
      name: row.name,
      label: row.label ?? undefined,
      icon: row.icon ?? undefined,
      fields: row.fields,
    };
    (row.role === 'section' ? sections : components)[row.name] = def;
  }
  const candidate: unknown = { version: 1, sections, components };
  if (!registryCheck.Check(candidate)) {
    throw new Error('Registre de contenu stocké invalide (corruption ?).');
  }
  return candidate;
}

function compileSections(registry: Registry): Map<string, TypeCheck<TSchema>> {
  const checks = new Map<string, TypeCheck<TSchema>>();
  for (const [name, def] of Object.entries(registry.sections)) {
    checks.set(name, TypeCompiler.Compile(definitionToSchema(def, registry.components)));
  }
  return checks;
}

async function ensureLoaded(): Promise<Cache> {
  if (!cache) {
    const rows = await db.select().from(contentDefinition);
    const registry = rowsToRegistry(rows);
    cache = { registry, sectionChecks: compileSections(registry) };
  }
  return cache;
}

// ── API publique ──────────────────────────────────────────────────────────────────────────────

/** Vide le cache — à appeler après tout `PUT /content/registry`. */
export function invalidateRegistryCache(): void {
  cache = null;
}

/** Registre stocké (pour l'admin / le type-gen). */
export async function loadRegistry(): Promise<Registry> {
  return (await ensureLoaded()).registry;
}

/**
 * Vérifie qu'un registre est COHÉRENT (toutes les refs `component`/`list` résolvent, pas de cycle)
 * en tentant de compiler toutes ses sections. Lève si incohérent. Appelé avant de persister un push.
 */
export function assertRegistryCoherent(registry: Registry): void {
  compileSections(registry);
}

// Aplati le registre (sections + components) en lignes `content_definition` (une par définition).
function registryToRows(registry: Registry): (typeof contentDefinition.$inferInsert)[] {
  const toRow =
    (role: 'section' | 'component') => (entry: [string, Registry['sections'][string]]) => {
      const [name, def] = entry;
      return { name, role, label: def.label ?? null, icon: def.icon ?? null, fields: def.fields };
    };
  return [
    ...Object.entries(registry.sections).map(toRow('section')),
    ...Object.entries(registry.components).map(toRow('component')),
  ];
}

/**
 * Cibles de champs `ref` que le registre cite sans qu'elles soient inscrites (ADR-0032).
 *
 * `RefField.to` n'est plus une union fermée : la grammaire ne peut donc plus refuser une cible
 * inexistante, et c'est ici que ça se joue. `knownTargets` vient de l'appelant — le socle ne
 * connaît pas les entités du produit, il ne fait que comparer des noms.
 *
 * Rend les noms fautifs, dédupliqués, chacun avec le champ qui le cite : un dev qui pousse un
 * registre fautif doit savoir OÙ corriger.
 */
export function unknownRefTargets(registry: Registry, knownTargets: string[]): string[] {
  const known = new Set(knownTargets);
  const faults = new Set<string>();

  const walkFields = (owner: string, fields: Record<string, SerializedField>): void => {
    for (const [key, field] of Object.entries(fields)) {
      if (field.kind === 'ref' && !known.has(field.to)) {
        faults.add(`${owner}.${key} → « ${field.to} »`);
      }
      if (field.kind === 'repeater') walkFields(`${owner}.${key}`, field.fields);
    }
  };

  for (const [name, def] of Object.entries(registry.sections)) walkFields(name, def.fields);
  for (const [name, def] of Object.entries(registry.components)) walkFields(name, def.fields);

  return [...faults];
}

export type SyncRegistryOutcome =
  | { outcome: 'synced' }
  /** Référence de component introuvable, cycle, ou cible de `ref` non inscrite : refusé AVANT de persister quoi que ce soit. */
  | { outcome: 'incoherent'; message: string };

/**
 * Remplace le registre stocké d'un bloc. La source d'autorité, ce sont les fichiers du dev ; la
 * base n'en est que le miroir. L'incohérence est une issue métier, pas une exception qui remonte.
 *
 * `knownTargets` : les cibles référençables que le produit a inscrites. Passées en argument plutôt
 * que lues ici — ce service ne doit pas connaître le registre d'Échoppe.
 */
export async function syncRegistry(
  registry: Registry,
  knownTargets: string[],
): Promise<SyncRegistryOutcome> {
  try {
    assertRegistryCoherent(registry);
  } catch (error) {
    return {
      outcome: 'incoherent',
      message: error instanceof Error ? error.message : 'Registre de contenu invalide',
    };
  }

  const faults = unknownRefTargets(registry, knownTargets);
  if (faults.length > 0) {
    return {
      outcome: 'incoherent',
      message: `Cibles référençables inconnues : ${faults.join(', ')}`,
    };
  }

  await db.transaction(async (tx) => {
    await tx.delete(contentDefinition);
    const rows = registryToRows(registry);
    if (rows.length > 0) {
      await tx.insert(contentDefinition).values(rows);
    }
  });

  invalidateRegistryCache();
  return { outcome: 'synced' };
}

type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/** Valide le `data` d'une section contre la définition de son `type` dans le registre. */
export async function validateSectionData(type: string, data: unknown): Promise<ValidationResult> {
  const { sectionChecks } = await ensureLoaded();
  const check = sectionChecks.get(type);
  if (!check) {
    return { ok: false, errors: [`Type de bloc inconnu : « ${type} »`] };
  }
  if (check.Check(data)) {
    return { ok: true };
  }
  const errors = [...check.Errors(data)].map((error) => `${error.path || '/'} ${error.message}`);
  return { ok: false, errors };
}
