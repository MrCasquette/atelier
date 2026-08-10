import { jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// La navigation (ADR-0033). Un menu n'est pas une page : il POINTE vers des choses, dont des pages
// — d'où son propre paquet plutôt qu'un coin de `@repo/pages`.
//
// Ce paquet a attendu ADR-0032. Tant que la cible d'un lien énumérait `product`, `collection`,
// `category`, la colonne `items` faisait entrer le vocabulaire commerce dans tout socle qui
// l'aurait accueillie. La cible est désormais un nom, et le registre dit lesquels existent.

/**
 * Lien d'un item de menu (stocké) : une URL, ou l'identifiant d'une entité résolue au read.
 *
 * `target` est un NOM de cible, pas une union fermée (ADR-0032) : `'url'` pour un lien en clair,
 * sinon le nom d'une cible inscrite au registre de références. Le socle ne sait pas lesquelles —
 * Échoppe inscrit `page`, `product`, `collection`, `category` ; Prisme inscrira les siennes.
 */
export interface MenuLink {
  target: string;
  value: string; // URL (target=url) ou UUID de l'entité ciblée
  newTab?: boolean;
}

// Item de menu (stocké), RÉCURSIF : `children` référence le même item (profondeur illimitée). Ce
// type figé sert à typer la colonne jsonb (parse-au-write, trust-au-read) ; la VALIDATION d'écriture
// vit dans `model.ts`, avec le schéma TypeBox récursif.
export interface MenuItem {
  label: string;
  link: MenuLink;
  children: MenuItem[];
}

// Menu de navigation (built-in) : arbre ORDONNÉ et RÉCURSIF d'items stocké en un seul jsonb.
// `handle` = clé stable fetchée par le front (main, footer…). Shape figé par le framework —
// hors registre @mrcasquette/content, qui décrit les blocs de page, pas la navigation.
export const menu = pgTable('menu', {
  id: uuid('id').primaryKey().defaultRandom(),
  handle: varchar('handle', { length: 100 }).unique().notNull(),
  label: varchar('label', { length: 200 }).notNull(),
  items: jsonb('items').$type<MenuItem[]>().notNull().default([]),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});
