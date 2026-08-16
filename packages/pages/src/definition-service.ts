// Validateur générique du module content (P2b).
//
// Le registre (table `content_definition`) décrit la forme des blocs déclarés par le dev. Ce
// service en dérive, à l'exécution, un validateur par type de section : chaque définition est
// TRADUITE en schéma TypeBox (récursif pour `list`/`repeater`/`component`), puis COMPILÉE une
// fois et mise en cache. C'est le pendant dynamique de l'ancienne union statique de
// `page/model.ts` côté produit.
//
// La traduction champ → schéma vit dans `@repo/fields` : elle est partagée avec les entités, qui
// n'ont que faire des pages (#35). Ce qui reste ici est propre au REGISTRE — le charger, le
// compiler par type de section, le mettre en cache, le remplacer.

import { db } from '@repo/db';
import {
  type Components,
  duplicateFieldNames,
  fieldsToSchema,
  issuesOf,
  type SerializedField,
  unresolvedComponents,
} from '@repo/fields';
import type { RegistryIssue, ValidationIssue } from '@repo/shared';
import type { TSchema } from 'elysia';
import { type TypeCheck, TypeCompiler } from 'elysia/type-system';
import { type Registry, registrySchema, type SerializedDefinition } from './definition-model';
import { contentDefinition } from './schema';

const registryCheck = TypeCompiler.Compile(registrySchema);

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
 * Ce qui empêche un registre de tenir debout : champs en double, `component` introuvable, cycle.
 *
 * Rendait naguère son verdict en LEVANT — le doublon avec sa propre phrase, les deux autres depuis
 * la compilation —, et la route promouvait le `message` en réponse HTTP. C'était le premier chemin
 * du tableau de violations d'ADR-0050. Les trois prédicats sont les mêmes ; seul le verdict a cessé
 * d'être une exception.
 *
 * Rend TOUTES les incohérences : un dev corrige son registre une fois, pas trois.
 *
 * Ne compile plus rien pour vérifier. Détecter en tentant de compiler faisait dépendre le diagnostic
 * de ce qui se trouvait lever en premier — et coûtait une compilation jetée à chaque push.
 */
export function registryIssues(registry: Registry): RegistryIssue[] {
  const definitions = [
    ...Object.entries(registry.sections),
    ...Object.entries(registry.components),
  ];

  const duplicates: RegistryIssue[] = definitions
    .flatMap(([name, def]) => duplicateFieldNames(name, def.fields))
    .map((path) => ({ path, reason: 'duplicate_field' }));

  const unresolved: RegistryIssue[] = definitions
    .flatMap(([name, def]) => unresolvedComponents(name, def.fields, registry.components))
    .map(({ path, kind }) => ({ path, reason: kind }));

  return [...duplicates, ...unresolved];
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
 * Rend les noms de CIBLES fautives, dédupliqués — et rien d'autre.
 *
 * Elle rendait naguère `hero.lien → « produit »`, pour dire aussi OÙ corriger. Le besoin était réel,
 * la forme non : c'était une phrase composée dans un opérande, que la surface ne pouvait ni
 * traduire ni remettre en forme. Et le critère d'ADR-0050 §5 le rend inutile — l'appelant vient de
 * soumettre le registre ENTIER, donc il retrouve seul quels champs citent une cible refusée. Ce
 * qu'il ne peut pas deviner, c'est la liste des cibles inscrites : c'est cela, et cela seul, qui
 * doit traverser.
 *
 * Même forme que ce que rend `unknownTargets` pour les menus, qui alimente le même code de faute.
 */
export function unknownRefTargets(registry: Registry, knownTargets: string[]): string[] {
  const known = new Set(knownTargets);
  const faults = new Set<string>();

  const walkFields = (fields: readonly SerializedField[]): void => {
    for (const field of fields) {
      if (field.kind === 'ref' && !known.has(field.to)) faults.add(field.to);
      if (field.kind === 'repeater') walkFields(field.fields);
    }
  };

  for (const def of Object.values(registry.sections)) walkFields(def.fields);
  for (const def of Object.values(registry.components)) walkFields(def.fields);

  return [...faults];
}

export type SyncRegistryOutcome =
  | { outcome: 'synced' }
  /** Champs en double, `component` introuvable ou cycle : refusé AVANT de persister quoi que ce soit. */
  | { outcome: 'incoherent'; issues: RegistryIssue[] }
  /**
   * Une cible de `ref` que le produit n'a pas inscrite (ADR-0032).
   *
   * Séparée de `incoherent`, et pas par goût du détail : le registre est bien formé, c'est son
   * ENVIRONNEMENT qui ne fournit pas la cible. Le dev corrige ailleurs, et le contrat a déjà un code
   * pour ça — `unknown_reference_targets`.
   */
  | { outcome: 'unknown_targets'; targets: string[] };

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
  const issues = registryIssues(registry);
  if (issues.length > 0) return { outcome: 'incoherent', issues };

  const targets = unknownRefTargets(registry, knownTargets);
  if (targets.length > 0) return { outcome: 'unknown_targets', targets };

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

/**
 * Le verdict d'une validation de section — TROIS issues, là où il n'y en avait que deux.
 *
 * `unknown_type` était rangé sous « données invalides », avec une phrase pour tout signalement. Ce
 * n'en est pas : la donnée n'a pas été examinée, faute de définition à quoi la comparer. C'est une
 * section introuvable, et le contrat a déjà un code pour ça.
 */
export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: 'unknown_type' }
  | { ok: false; reason: 'invalid'; issues: ValidationIssue[] };

/** Valide le `data` d'une section contre la définition de son `type` dans le registre. */
export async function validateSectionData(type: string, data: unknown): Promise<ValidationResult> {
  const { sectionChecks } = await ensureLoaded();
  const check = sectionChecks.get(type);
  if (!check) return { ok: false, reason: 'unknown_type' };
  if (check.Check(data)) return { ok: true };
  return { ok: false, reason: 'invalid', issues: issuesOf(check, data) };
}
