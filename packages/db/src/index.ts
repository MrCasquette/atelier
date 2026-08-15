// @repo/db — la connexion et le vocabulaire de requête, rien d'autre.
//
// N'importer AUCUN schéma ici : ce paquet est en dessous de tout le monde et ne dépend de personne.
// Les migrations appartiennent aux cœurs produit. Voir README.md.
export type { Column, SQL } from 'drizzle-orm';
export {
  and,
  asc,
  count,
  desc,
  eq,
  getTableName,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
export { client, type Database, db } from './client';
export { runMigrations } from './migrate';
