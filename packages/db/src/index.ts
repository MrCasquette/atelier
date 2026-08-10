// @repo/db — la connexion et le vocabulaire de requête, rien d'autre.
//
// Ce paquet ne connaît AUCUN schéma. C'est ce qui lui permet d'être en dessous de tout le monde :
// les paquets partagés comme les cœurs produit en dépendent, il ne dépend de personne. La flèche
// va toujours du produit vers le paquet (ADR-0025), y compris pour l'accès base.

// Vocabulaire de requête — réexporté ici pour qu'un paquet partagé n'ait pas à déclarer
// drizzle-orm en dépendance directe juste pour écrire un `eq`.
//
// `getTableName` en fait partie : ce qui écrit du DDL visant une table — une clé étrangère dérivée
// d'une entité (ADR-0045) — lit son nom sur la table elle-même plutôt que de recopier une chaîne.
// Le schéma reste la seule source, et un renommage ne peut pas laisser un littéral périmé derrière.
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
