import { db, sql } from '@repo/db';
import { type Components, compileFields, type SerializedField } from '@repo/fields';
import { entityTableName, fieldColumns } from './ddl';
import type { EntityDeclaration } from './model';
import { type EntityRow, projectRow, selectionOf } from './row-service';

// Écriture des OCCURRENCES d'une entité. Comme pour la lecture, tout se construit à la main faute
// de table Drizzle — mais la règle ne change pas : les IDENTIFIANTS viennent du journal, donc de la
// liste blanche de `ddl.ts`, et les VALEURS sont toujours liées, jamais interpolées.

/** Ce qu'on écrit : le slug (entité de liste seulement) et les champs déclarés. */
export type EntityInput = { slug?: string; data: Record<string, unknown> };

export type WriteOutcome =
  | { outcome: 'written'; row: EntityRow }
  /** La donnée ne respecte pas la déclaration : dit quels champs, et pourquoi. */
  | { outcome: 'invalid'; errors: string[] }
  /**
   * La base a refusé l'écriture pour une contrainte d'identité. `reason` dit LAQUELLE — ce que
   * l'ancien message fusionnait faute de savoir distinguer.
   */
  | { outcome: 'conflict'; reason: 'slug_taken' | 'cardinality' }
  | { outcome: 'absent' };

// Les validateurs sont compilés une fois par déclaration. La clé inclut les champs eux-mêmes :
// un push qui change la déclaration produit une nouvelle clé, donc un nouveau validateur — pas de
// cache à invalider à la main, pas d'oubli possible.
const checks = new Map<string, ReturnType<typeof compileFields>>();

function checkFor(
  declaration: EntityDeclaration,
  components: Components,
): ReturnType<typeof compileFields> {
  const key = `${declaration.name}:${JSON.stringify(declaration.fields)}`;
  const cached = checks.get(key);
  if (cached) return cached;
  const compiled = compileFields(declaration.fields, components);
  checks.set(key, compiled);
  return compiled;
}

/**
 * Valide la donnée écrite contre la déclaration de l'entité.
 *
 * Même traduction que pour une section (ADR-0026 : le schema et son validateur sont partagés
 * intégralement). `components` vient de l'appelant : un champ `list`/`component` d'une entité
 * référence le registre de définitions, que ce paquet n'a pas à connaître.
 */
export function validateEntityData(
  declaration: EntityDeclaration,
  data: unknown,
  components: Components,
): { ok: true } | { ok: false; errors: string[] } {
  const check = checkFor(declaration, components);
  if (check.Check(data)) return { ok: true };
  return {
    ok: false,
    errors: [...check.Errors(data)].map((error) => `${error.path || '/'} ${error.message}`),
  };
}

// Un champ dont la colonne est `jsonb` doit voyager en texte JSON : le driver ne peut pas deviner
// qu'un objet est destiné à du jsonb plutôt qu'à un type composite.
const JSONB_KINDS = new Set(['component', 'list', 'repeater']);

function bindable(field: SerializedField, value: unknown): unknown {
  return JSONB_KINDS.has(field.kind) && value !== undefined && value !== null
    ? JSON.stringify(value)
    : value;
}

type Assignment = { column: string; value: unknown };

function assignmentsOf(
  declaration: EntityDeclaration,
  data: Record<string, unknown>,
): Assignment[] {
  // `fieldColumns` rend une colonne par champ, DANS LE MÊME ORDRE : l'appariement est positionnel,
  // sans index intermédiaire à construire (ADR-0049).
  const columns = fieldColumns(declaration.fields);
  return declaration.fields
    .map((field, index) => ({ field, column: columns[index] }))
    .filter(({ column }) => data[column.name] !== undefined)
    .map(({ field, column }) => ({
      column: column.name,
      value: bindable(field, data[column.name]),
    }));
}

// Postgres distingue « violation d'unicité » (23505) et « violation de contrainte » (23514) : la
// première est un slug déjà pris ou la seconde ligne d'un singleton, la seconde est la cardinalité.
// Dans les deux cas c'est un CONFLIT métier, pas une panne — d'où une issue typée plutôt qu'un jet.
const CONFLICT_CODES = new Set(['23505', '23514']);

/**
 * Code SQLSTATE d'une erreur, en traversant l'enveloppe du driver.
 *
 * Drizzle enveloppe l'erreur Postgres dans une erreur à lui et n'en recopie PAS le `code` : le
 * lire à la surface ne trouve jamais rien, et tout conflit se serait alors présenté en 500. Le
 * défaut n'était visible qu'en base réelle, d'où le filet d'intégration sur un slug déjà pris.
 */
function postgresCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && typeof current === 'object' && depth < 4; depth += 1) {
    if ('code' in current && typeof current.code === 'string') return current.code;
    current = 'cause' in current ? current.cause : null;
  }
  return undefined;
}

/**
 * Traduit une erreur Postgres en issue métier — ou la LAISSE REMONTER.
 *
 * Seuls les codes de conflit connus deviennent une valeur de retour : le reste est une erreur
 * exceptionnelle, et l'aplatir en « l'écriture a été refusée » masquerait un défaut du mécanisme
 * derrière un message d'utilisateur. Erreur attendue et erreur exceptionnelle ne se traitent pas
 * pareil (typescript.md §6).
 */
function asConflict(
  error: unknown,
  declaration: EntityDeclaration,
): { outcome: 'conflict'; reason: 'slug_taken' | 'cardinality' } {
  const code = postgresCode(error);
  if (!code || !CONFLICT_CODES.has(code)) throw error;

  // Le discriminant est NOTRE déclaration, pas le nom que Postgres a donné à la contrainte.
  //
  // `identityColumns` (ddl.ts) rend les deux colonnes MUTUELLEMENT EXCLUSIVES : une entité de liste
  // porte `slug ... unique` et pas de colonne `singleton` ; un singleton porte
  // `singleton ... unique check (singleton)` et pas de slug. Un 23505 n'a donc qu'une cause
  // possible de chaque côté, et le seul CHECK du schéma est celui du singleton.
  //
  // Lire `error.constraint` aurait marché aussi, mais nos migrations ne NOMMENT pas ces contraintes
  // — les noms viennent de la convention de Postgres, donc d'un contrat que nous ne maîtrisons pas.
  // La cardinalité, elle, est à nous.
  if (code === '23505' && !declaration.singleton)
    return { outcome: 'conflict', reason: 'slug_taken' };
  return { outcome: 'conflict', reason: 'cardinality' };
}

export async function createEntityRow(
  declaration: EntityDeclaration,
  input: EntityInput,
): Promise<WriteOutcome> {
  const table = entityTableName(declaration.name);
  const assignments = assignmentsOf(declaration, input.data);

  if (!declaration.singleton) {
    if (!input.slug) {
      return { outcome: 'invalid', errors: ['/slug est requis pour une entité de liste'] };
    }
    assignments.unshift({ column: 'slug', value: input.slug });
  }

  const columns = assignments.map((assignment) => assignment.column).join(', ');
  const values = sql.join(
    assignments.map((assignment) => sql`${assignment.value}`),
    sql`, `,
  );

  try {
    const rows = await db.execute<Record<string, unknown>>(
      sql`${sql.raw(`insert into ${table} (${columns}) values (`)}${values}${sql.raw(`) returning ${selectionOf(declaration)}`)}`,
    );
    return { outcome: 'written', row: projectRow(rows[0]) };
  } catch (error) {
    return asConflict(error, declaration);
  }
}

export async function updateEntityRow(
  declaration: EntityDeclaration,
  id: string,
  input: EntityInput,
): Promise<WriteOutcome> {
  const table = entityTableName(declaration.name);
  const assignments = assignmentsOf(declaration, input.data);
  if (!declaration.singleton && input.slug !== undefined) {
    assignments.unshift({ column: 'slug', value: input.slug });
  }
  if (assignments.length === 0) {
    return { outcome: 'invalid', errors: ['Aucun champ à modifier'] };
  }

  const setters = sql.join(
    assignments.map((assignment) => sql`${sql.raw(assignment.column)} = ${assignment.value}`),
    sql`, `,
  );

  try {
    const rows = await db.execute<Record<string, unknown>>(
      sql`${sql.raw(`update ${table} set `)}${setters}${sql.raw(', date_updated = now() where id = ')}${id}${sql.raw(` returning ${selectionOf(declaration)}`)}`,
    );
    return rows[0] ? { outcome: 'written', row: projectRow(rows[0]) } : { outcome: 'absent' };
  } catch (error) {
    return asConflict(error, declaration);
  }
}

export async function deleteEntityRow(
  declaration: EntityDeclaration,
  id: string,
): Promise<boolean> {
  const table = entityTableName(declaration.name);
  const rows = await db.execute<{ id: string }>(
    sql`${sql.raw(`delete from ${table} where id = `)}${id}${sql.raw(' returning id')}`,
  );
  return rows.length > 0;
}
