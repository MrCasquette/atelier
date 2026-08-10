import { jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// Le menu attend son paquet — `@repo/menus`, pas `@repo/pages` : un menu n'est pas une page. Il ne
// reste ici que parce que le déplacement n'a pas encore été fait ; plus rien dans ce fichier ne
// nomme le vocabulaire commerce depuis qu'ADR-0032 a ouvert la cible en registre.

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
// vit côté API (modules/menu/model.ts, schéma TypeBox récursif — le `Static` récursif s'y attache
// via `t.Unsafe<MenuItem>`).
export interface MenuItem {
  label: string;
  link: MenuLink;
  children: MenuItem[];
}

// Menu de navigation (built-in) : arbre ORDONNÉ et RÉCURSIF d'items stocké en un seul jsonb.
// `handle` = clé stable fetchée par le front (main, footer…). Le lien cible une URL ou une entité
// inscrite au registre de références, résolue au read storefront. Shape figé par le framework
// (validation dédiée, cf. modules/menu/model.ts) — hors registre @mrcasquette/content.
export const menu = pgTable('menu', {
  id: uuid('id').primaryKey().defaultRandom(),
  handle: varchar('handle', { length: 100 }).unique().notNull(),
  label: varchar('label', { length: 200 }).notNull(),
  items: jsonb('items').$type<MenuItem[]>().notNull().default([]),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});
