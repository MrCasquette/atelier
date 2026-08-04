// @repo/db — la connexion et le vocabulaire de requête, rien d'autre.
//
// Ce paquet ne connaît AUCUN schéma. C'est ce qui lui permet d'être en dessous de tout le monde :
// les paquets partagés comme les cœurs produit en dépendent, il ne dépend de personne. La flèche
// va toujours du produit vers le paquet (ADR-0025), y compris pour l'accès base.

// Vocabulaire de requête — réexporté ici pour qu'un paquet partagé n'ait pas à déclarer
// drizzle-orm en dépendance directe juste pour écrire un `eq`.
export type { Column, SQL } from 'drizzle-orm';
export {
  and,
  asc,
  count,
  desc,
  eq,
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
