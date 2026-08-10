import { db, sql } from '@repo/db';
import { entityTableName, fieldColumns, isValidIdentifier } from './ddl';
import type { EntityDeclaration } from './model';
import { loadEntities } from './service';

// Lecture des OCCURRENCES d'une entité. Le service voisin (`service.ts`) s'occupe de la structure ;
// celui-ci ne touche qu'aux lignes.
//
// Tout passe par du SQL construit à la main, faute de table Drizzle : elle n'existe pas à la
// compilation, c'est tout l'objet d'ADR-0027. Ce qui rend ça sûr n'est pas l'échappement mais la
// PROVENANCE des identifiants — table et colonnes viennent du journal, qui n'a pu être écrit qu'en
// passant la liste blanche de `ddl.ts`. Aucune valeur de requête n'entre jamais dans le texte SQL :
// elles sont toutes liées.

/** Une occurrence, telle que l'API la rend. */
export type EntityRow = Record<string, unknown>;

export type EntityLookup =
  | { outcome: 'found'; declaration: EntityDeclaration }
  /** L'entité n'est pas déclarée : c'est une erreur de code, pas un état du produit. */
  | { outcome: 'undeclared' };

export async function findDeclaration(name: string): Promise<EntityLookup> {
  if (!isValidIdentifier(name)) return { outcome: 'undeclared' };
  const declaration = (await loadEntities())[name];
  return declaration ? { outcome: 'found', declaration } : { outcome: 'undeclared' };
}

// Les colonnes d'identité portent, à la lecture, les noms du reste de l'API (`dateCreated`), pas
// ceux de la base. Les champs déclarés, eux, gardent exactement le nom que le dev leur a donné :
// c'est le sien, on n'y touche pas.
const IDENTITY_PROJECTION: Record<string, string> = {
  id: 'id',
  slug: 'slug',
  date_created: 'dateCreated',
  date_updated: 'dateUpdated',
};

export function selectionOf(declaration: EntityDeclaration): string {
  const columns = [
    'id',
    ...(declaration.singleton ? [] : ['slug']),
    ...fieldColumns(declaration.fields).map((column) => column.name),
    'date_created',
    'date_updated',
  ];
  return columns.join(', ');
}

export function projectRow(row: Record<string, unknown>): EntityRow {
  const projected: EntityRow = {};
  for (const [column, value] of Object.entries(row)) {
    projected[IDENTITY_PROJECTION[column] ?? column] = value;
  }
  return projected;
}

export type EntityPage = { rows: EntityRow[]; total: number };

/** Occurrences d'une entité de liste, les plus récentes d'abord. */
export async function listEntityRows(
  declaration: EntityDeclaration,
  limit: number,
  offset: number,
): Promise<EntityPage> {
  const table = entityTableName(declaration.name);

  const rows = await db.execute<Record<string, unknown>>(
    sql.raw(
      `select ${selectionOf(declaration)} from ${table} order by date_created desc limit ${Math.trunc(limit)} offset ${Math.trunc(offset)}`,
    ),
  );
  const [counted] = await db.execute<{ total: number }>(
    sql.raw(`select count(*)::int as total from ${table}`),
  );

  return { rows: rows.map(projectRow), total: counted?.total ?? 0 };
}

/** Une occurrence par son slug. `null` si aucune ne porte ce slug. */
export async function findEntityRowBySlug(
  declaration: EntityDeclaration,
  slug: string,
): Promise<EntityRow | null> {
  const table = entityTableName(declaration.name);
  const rows = await db.execute<Record<string, unknown>>(
    sql`${sql.raw(`select ${selectionOf(declaration)} from ${table}`)} where slug = ${slug} limit 1`,
  );
  return rows[0] ? projectRow(rows[0]) : null;
}

/**
 * L'unique occurrence d'un singleton, ou `null`.
 *
 * `null` est un état NORMAL du produit : le dev a déclaré l'entité, personne ne l'a encore
 * remplie. Aucune ligne n'est créée à l'activation (ADR-0039), et le consommateur doit gérer ce
 * cas — c'est le prix de ne rien fabriquer d'office.
 */
export async function findSingletonRow(declaration: EntityDeclaration): Promise<EntityRow | null> {
  const table = entityTableName(declaration.name);
  const rows = await db.execute<Record<string, unknown>>(
    sql.raw(`select ${selectionOf(declaration)} from ${table} limit 1`),
  );
  return rows[0] ? projectRow(rows[0]) : null;
}
