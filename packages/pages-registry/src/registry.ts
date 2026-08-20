// La logique du registre, sans stockage.
//
// Une définition décrit la forme d'un bloc déclaré par le dev. Ce module en dérive tout ce qui se
// calcule : la traduction en schéma TypeBox, la compilation d'un validateur par type de section, le
// diagnostic d'incohérence, et le verdict d'une donnée soumise.
//
// Il n'ouvre aucune connexion et n'en connaît aucune — `@repo/db` n'est pas dans son manifeste, donc
// l'import ne résoudrait même pas (ADR-0059). C'est ce qui rend ces fonctions éprouvables sans base,
// et ce qui permet à un registre d'être validé avant d'être stocké : dans un CMS config-as-code, la
// source d'autorité ce sont les fichiers du dev, la base n'en est que le miroir.

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
import { type Registry, registrySchema, type SerializedDefinition } from './model';

const registryCheck = TypeCompiler.Compile(registrySchema);

/** Les validateurs compilés, un par type de section. */
export type SectionChecks = Map<string, TypeCheck<TSchema>>;

export const definitionToSchema = (def: SerializedDefinition, components: Components): TSchema =>
  fieldsToSchema(def.fields, components, new Set());

export function compileSections(registry: Registry): SectionChecks {
  const checks: SectionChecks = new Map();
  for (const [name, def] of Object.entries(registry.sections)) {
    checks.set(name, TypeCompiler.Compile(definitionToSchema(def, registry.components)));
  }
  return checks;
}

// ── Traductions registre ↔ lignes ─────────────────────────────────────────────────────────────
//
// La forme d'une ligne est décrite ici structurellement, et non importée d'une table : ce module ne
// doit pas savoir dans quoi le registre est rangé. Un stockage qui a ces colonnes lui convient.

export type RegistryRow = {
  readonly name: string;
  readonly role: string;
  readonly label: string | null;
  readonly icon: string | null;
  readonly fields: unknown;
};

export type RegistryRowInput = {
  name: string;
  role: 'section' | 'component';
  label: string | null;
  icon: string | null;
  fields: readonly SerializedField[];
};

/**
 * Reconstruit le registre depuis les lignes stockées.
 *
 * On revalide contre le schéma : le stockage est censé être sain, mais du jsonb n'est pas typé, et
 * c'est cette vérification — pas une affirmation — qui donne le type en retour.
 *
 * Lève, et c'est voulu : un registre stocké invalide est une corruption, pas une faute métier.
 */
export function rowsToRegistry(rows: readonly RegistryRow[]): Registry {
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

/** Aplatit le registre en lignes, une par définition — sections et components partagent la table. */
export function registryToRows(registry: Registry): RegistryRowInput[] {
  const toRow =
    (role: 'section' | 'component') =>
    (entry: [string, Registry['sections'][string]]): RegistryRowInput => {
      const [name, def] = entry;
      return { name, role, label: def.label ?? null, icon: def.icon ?? null, fields: def.fields };
    };
  return [
    ...Object.entries(registry.sections).map(toRow('section')),
    ...Object.entries(registry.components).map(toRow('component')),
  ];
}

// ── Diagnostic ────────────────────────────────────────────────────────────────────────────────

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

/**
 * Cibles de champs `ref` que le registre cite sans qu'elles soient inscrites (ADR-0032).
 *
 * `RefField.to` n'est plus une union fermée : la grammaire ne peut donc plus refuser une cible
 * inexistante, et c'est ici que ça se joue. `knownTargets` vient de l'appelant — ce paquet ne
 * connaît pas les entités d'un produit, il ne fait que comparer des noms.
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

// ── Verdict ───────────────────────────────────────────────────────────────────────────────────

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

/** Valide le `data` d'une section contre le validateur compilé de son `type`. */
export function checkSection(
  checks: SectionChecks,
  type: string,
  data: unknown,
): ValidationResult {
  const check = checks.get(type);
  if (!check) return { ok: false, reason: 'unknown_type' };
  if (check.Check(data)) return { ok: true };
  return { ok: false, reason: 'invalid', issues: issuesOf(check, data) };
}
