import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// Page builder headless (modèle façon Strapi : dynamic zone). Une PAGE possède une liste ordonnée
// de SECTIONS (blocs embarqués). Une section est un bloc typé dont les champs vivent en `data`
// (jsonb), validés à la frontière API par un schéma compilé depuis `content_definition`.
//
// Blocs EMBARQUÉS : une section appartient à UNE page (pas de partage inter-pages). Un « bloc
// partagé » = un type-marqueur (ex. CtaShared) rendu par un composant du front du dev.
//
// Le MENU n'est pas ici : sa cible énumère encore le vocabulaire commerce (`product`, `collection`,
// `category`) dans le type de sa colonne jsonb. Il rejoindra son propre paquet quand #8 aura ouvert
// `RefTarget` en registre d'entités déclarées (ADR-0032) — d'ici là il reste dans le cœur d'Échoppe.

export const contentStatusEnum = pgEnum('content_status', ['draft', 'published']);

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

// Registre des DÉFINITIONS de contenu (P2b). Miroir en DB des fichiers `@axiome-apps/atelier-content` du
// dev : la CLI sérialise ses `defineComponent`/`defineSection` et remplace ce registre via
// `PUT /content/registry`. L'API en dérive la VALIDATION d'écriture des sections (schéma compilé
// depuis `fields`), et l'admin les FORMULAIRES d'édition. Une ligne = une définition ; `name` est
// unique globalement (sections + components partagent le namespace, cf. garde de collision).
export const contentDefinition = pgTable('content_definition', {
  name: varchar('name', { length: 150 }).primaryKey(),
  role: varchar('role', { length: 20 }).notNull(), // 'section' (insérable en page) | 'component'
  label: varchar('label', { length: 200 }),
  icon: varchar('icon', { length: 100 }),
  // SÉQUENCE [{ name, kind, … }] — cf. @axiome-apps/atelier-content. L'ordre y est de l'information : c'est
  // celui du formulaire d'administration généré. `jsonb` le préserve, un tableau étant ordonné par
  // construction (ADR-0049) — ce qui n'était pas vrai de l'objet qu'il remplace, d'où le passage
  // temporaire à `json` sous #46.
  fields: jsonb('fields').notNull(),
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
