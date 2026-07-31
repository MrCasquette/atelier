import { integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { contentStatusEnum } from './enums';

// Module « content » — page builder headless (modèle façon Strapi : dynamic zone). Une PAGE
// possède une liste ordonnée de SECTIONS (blocs embarqués). Une section est un bloc typé dont
// les champs vivent en `data` (jsonb), validés à la frontière API par une union discriminée
// (cf. models/content.ts). Le HTML riche (bloc richText) est une chaîne dans `data.html`.
//
// Blocs EMBARQUÉS : une section appartient à UNE page (pas de partage inter-pages). Un « bloc
// partagé » = un type-marqueur (ex. CtaShared) rendu par un composant du front du dev.

// Page éditoriale (home, à propos, CGV…). Son contenu = ses sections ordonnées.
export const page = pgTable('page', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 150 }).unique().notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  seoTitle: varchar('seo_title', { length: 200 }),
  seoDescription: text('seo_description'),
  status: contentStatusEnum('status').notNull().default('draft'),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});

// Registre des DÉFINITIONS de contenu (P2b). Miroir en DB des fichiers `@mrcasquette/content` du
// dev : la CLI sérialise ses `defineComponent`/`defineSection` et remplace ce registre via
// `PUT /content/registry`. L'API en dérive la VALIDATION d'écriture des sections (schéma compilé
// depuis `fields`), et l'admin les FORMULAIRES d'édition. Une ligne = une définition ; `name` est
// unique globalement (sections + components partagent le namespace, cf. garde de collision).
export const contentDefinition = pgTable('content_definition', {
  name: varchar('name', { length: 150 }).primaryKey(),
  role: varchar('role', { length: 20 }).notNull(), // 'section' (insérable en page) | 'component'
  label: varchar('label', { length: 200 }),
  icon: varchar('icon', { length: 100 }),
  fields: jsonb('fields').notNull(), // dictionnaire { [champ]: SerializedField } — cf. @mrcasquette/content
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});

// Lien d'un item de menu (stocké) : une URL, ou l'UUID d'une entité interne résolue au read.
export interface MenuLink {
  target: 'url' | 'page' | 'product' | 'collection' | 'category';
  value: string; // URL (target=url) ou UUID de l'entité ciblée
  newTab?: boolean;
}

// Item de menu (stocké), RÉCURSIF : `children` référence le même item (profondeur illimitée). Ce
// type figé sert à typer la colonne jsonb (parse-au-write, trust-au-read) ; la VALIDATION d'écriture
// vit côté API (models/menu.ts, schéma TypeBox récursif — le `Static` récursif s'y attache via
// `t.Unsafe<MenuItem>`).
export interface MenuItem {
  label: string;
  link: MenuLink;
  children: MenuItem[];
}

// Menu de navigation (built-in) : arbre ORDONNÉ et RÉCURSIF d'items stocké en un seul jsonb.
// `handle` = clé stable fetchée par le front (main, footer…). Le lien cible une URL ou une entité
// interne (page/produit/collection/catégorie), résolue au read storefront. Shape figé par le
// framework (validation dédiée, cf. models/menu.ts) — hors registre @mrcasquette/content.
export const menu = pgTable('menu', {
  id: uuid('id').primaryKey().defaultRandom(),
  handle: varchar('handle', { length: 100 }).unique().notNull(),
  label: varchar('label', { length: 200 }).notNull(),
  items: jsonb('items').$type<MenuItem[]>().notNull().default([]),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});

// Section = un bloc typé embarqué, possédé par une page, positionné via `sort`.
export const section = pgTable('section', {
  id: uuid('id').primaryKey().defaultRandom(),
  page: uuid('page')
    .notNull()
    .references(() => page.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }), // libellé admin optionnel (repérage dans le builder)
  type: varchar('type', { length: 50 }).notNull(), // hero, richText, productGrid, image, cta…
  data: jsonb('data').notNull(), // champs du bloc, SANS le type (porté par la colonne `type`)
  sort: integer('sort').notNull().default(0),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});
