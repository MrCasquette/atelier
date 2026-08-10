import { jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// Le menu reste dans le cœur d'Échoppe tant que sa CIBLE énumère le vocabulaire commerce. Ce n'est
// pas un choix de découpage : `MenuLink.target` type la colonne `items`, donc déplacer cette table
// dans un paquet partagé y ferait entrer `product`, `collection` et `category` — ce qu'ADR-0032
// interdit.
//
// #8 ouvre `RefTarget` en registre : la cible devient un nom d'entité déclarée, Échoppe inscrit les
// siennes au démarrage (comme elle inscrit ses gabarits d'e-mail depuis #7) et Prisme n'inscrit que
// `page`. La table devient alors générique et part dans son propre paquet, `@repo/menus` — pas dans
// `@repo/pages`, un menu n'est pas une page.

// Lien d'un item de menu (stocké) : une URL, ou l'UUID d'une entité interne résolue au read.
export interface MenuLink {
  target: 'url' | 'page' | 'product' | 'collection' | 'category';
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
// interne (page/produit/collection/catégorie), résolue au read storefront. Shape figé par le
// framework (validation dédiée, cf. modules/menu/model.ts) — hors registre @mrcasquette/content.
export const menu = pgTable('menu', {
  id: uuid('id').primaryKey().defaultRandom(),
  handle: varchar('handle', { length: 100 }).unique().notNull(),
  label: varchar('label', { length: 200 }).notNull(),
  items: jsonb('items').$type<MenuItem[]>().notNull().default([]),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});
