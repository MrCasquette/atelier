import { media } from '@repo/assets';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  decimal,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { taxRate } from './referential';

export const productStatusEnum = pgEnum('product_status', ['draft', 'published', 'archived']);
// Type d'une option produit : pilote le widget admin et le rendu storefront. `string` = valeur
// texte (défaut) ; `color` = pastille, la valeur porte une couleur oklch dans `optionValue.metadata`.
export const optionTypeEnum = pgEnum('option_type', ['string', 'color']);
// Type d'un champ de personnalisation produit (ADR-0010) : pilote le widget admin/storefront.
export const personalizationFieldTypeEnum = pgEnum('personalization_field_type', [
  'text',
  'textarea',
]);

export const category = pgTable('category', {
  id: uuid('id').primaryKey().defaultRandom(),
  parent: uuid('parent').references((): AnyPgColumn => category.id),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  description: text('description'),
  image: uuid('image').references(() => media.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  isVisible: boolean('is_visible').notNull().default(true),
});

export const collection = pgTable('collection', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  description: text('description'),
  image: uuid('image').references(() => media.id, { onDelete: 'set null' }),
  isVisible: boolean('is_visible').notNull().default(true),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
});

export const product = pgTable('product', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: uuid('category')
    .notNull()
    .references(() => category.id),
  taxRate: uuid('tax_rate')
    .notNull()
    .references(() => taxRate.id),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  description: text('description'),
  status: productStatusEnum('status').notNull().default('draft'),
  // Personnalisation optionnelle (ADR-0010) : false → aucune, true → champs déclarés ci-dessous.
  personalizationEnabled: boolean('personalization_enabled').notNull().default(false),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});

export const productCollection = pgTable(
  'product_collection',
  {
    product: uuid('product')
      .notNull()
      .references(() => product.id),
    collection: uuid('collection')
      .notNull()
      .references(() => collection.id),
  },
  (table) => [primaryKey({ columns: [table.product, table.collection] })],
);

export const productMedia = pgTable(
  'product_media',
  {
    product: uuid('product')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    media: uuid('media')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    isFeatured: boolean('is_featured').notNull().default(false),
    featuredForVariant: uuid('featured_for_variant').references((): AnyPgColumn => variant.id),
  },
  (table) => [
    primaryKey({ columns: [table.product, table.media] }),
    // Une seule image featured par produit
    uniqueIndex('product_media_featured_unique')
      .on(table.product)
      .where(sql`${table.isFeatured} = true`),
    // Une seule image par variante
    uniqueIndex('product_media_variant_unique')
      .on(table.featuredForVariant)
      .where(sql`${table.featuredForVariant} IS NOT NULL`),
  ],
);

// Options globales (Couleur, Taille, Matière...)
export const option = pgTable(
  'option',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 50 }).notNull(), // Color, Size...
    // Type de l'axe : `string` (défaut) ou `color`. Identifie l'axe sans dépendre du nom
    // (fragile, i18n) et pilote widget admin + rendu storefront.
    type: optionTypeEnum('type').notNull().default('string'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    // Unique case-insensitive sur le nom (évite couleur/Couleur/COULEUR)
    uniqueIndex('option_name_unique_ci').on(sql`lower(${table.name})`),
  ],
);

// Junction: quelles options un produit utilise
export const productOption = pgTable(
  'product_option',
  {
    product: uuid('product')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    option: uuid('option')
      .notNull()
      .references(() => option.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0), // Position de l'option pour ce produit
  },
  (table) => [primaryKey({ columns: [table.product, table.option] })],
);

// Métadonnée d'une valeur d'option, discriminée par `option.type` PARENT (l'option est SSOT,
// pas de `type` redondant ici). SSOT de la forme couleur oklch canonique `{ l, c, h, alpha }`,
// typant la colonne jsonb (parse-au-write via la validation API selon le type parent, trust-au-read).
// Les BORNES/validation vivent côté API (`colorMetadataSchema` TypeBox, gardé aligné sur ce type).
// `color` : rendu `oklch(l c h / alpha)`. `string` : pas de metadata (null).
export interface ColorMetadata {
  l: number; // lightness 0–1
  c: number; // chroma (gamut réel dépend de l/h, géré au picker + navigateur)
  h: number; // hue 0–360
  alpha: number; // opacité 0–1
}
export type OptionValueMetadata = ColorMetadata;

export const optionValue = pgTable(
  'option_value',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    option: uuid('option')
      .notNull()
      .references(() => option.id, { onDelete: 'cascade' }),
    value: varchar('value', { length: 100 }).notNull(), // Red, M, XL...
    metadata: jsonb('metadata').$type<OptionValueMetadata>(), // null pour type=string
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    // Unique case-insensitive par option (évite rouge/Rouge dans la même option)
    uniqueIndex('option_value_unique_ci').on(table.option, sql`lower(${table.value})`),
  ],
);

export const variant = pgTable('variant', {
  id: uuid('id').primaryKey().defaultRandom(),
  product: uuid('product')
    .notNull()
    .references(() => product.id),
  sku: varchar('sku', { length: 50 }).unique(),
  barcode: varchar('barcode', { length: 50 }),
  priceHt: decimal('price_ht', { precision: 10, scale: 2 }).notNull(),
  compareAtPriceHt: decimal('compare_at_price_ht', { precision: 10, scale: 2 }), // Strike-through price
  costPrice: decimal('cost_price', { precision: 10, scale: 2 }), // Cost price
  weight: decimal('weight', { precision: 10, scale: 3 }), // kg
  length: decimal('length', { precision: 10, scale: 2 }), // cm
  width: decimal('width', { precision: 10, scale: 2 }), // cm
  height: decimal('height', { precision: 10, scale: 2 }), // cm
  isDefault: boolean('is_default').notNull().default(false),
  status: productStatusEnum('status').notNull().default('draft'),
  sortOrder: integer('sort_order').notNull().default(0),
  quantity: integer('quantity').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').default(5),
});

// Champ de personnalisation déclaré par un produit (ADR-0010). Présent uniquement si
// `product.personalizationEnabled`. Symétrique des options : la déclaration vit au catalogue, la
// valeur saisie vit sur la ligne (`cart_item`/`order_item`). Le supplément `priceHt` est autoritaire.
export const personalizationField = pgTable('personalization_field', {
  id: uuid('id').primaryKey().defaultRandom(),
  product: uuid('product')
    .notNull()
    .references(() => product.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 100 }).notNull(), // « Prénom »
  type: personalizationFieldTypeEnum('type').notNull().default('text'),
  required: boolean('required').notNull().default(false),
  maxLength: integer('max_length'), // garde-fou texte (null = illimité)
  priceHt: decimal('price_ht', { precision: 10, scale: 2 }).notNull().default('0.00'), // supplément
  sortOrder: integer('sort_order').notNull().default(0),
});

// Tag produit (B3) : étiquette libre gérée comme entité (slug canonique), pas un tableau texte
// sur le produit — réutilisable, dédupliqué, filtrable. Le `name` est le libellé affiché
// storefront, le `slug` l'identité stable (upsert au write).
export const tag = pgTable('tag', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull(),
  slug: varchar('slug', { length: 50 }).unique().notNull(),
});

// Junction produit ↔ tag (sémantique set côté API : le PUT produit remplace l'ensemble).
export const productTag = pgTable(
  'product_tag',
  {
    product: uuid('product')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    tag: uuid('tag')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.product, table.tag] })],
);

// Produits liés (B8) — relation DIRECTIONNELLE curée : sur la fiche `product`, le commerçant
// choisit et ordonne `relatedProduct`. Asymétrique (A→B n'implique pas B→A). Sémantique set côté
// API (le PUT produit remplace l'ensemble ordonné). Fallback voisinage si vide, calculé à la lecture.
export const productRelated = pgTable(
  'product_related',
  {
    product: uuid('product')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    relatedProduct: uuid('related_product')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.product, table.relatedProduct] })],
);

export const variantOptionValue = pgTable(
  'variant_option_value',
  {
    variant: uuid('variant')
      .notNull()
      .references(() => variant.id),
    optionValue: uuid('option_value')
      .notNull()
      .references(() => optionValue.id),
  },
  (table) => [primaryKey({ columns: [table.variant, table.optionValue] })],
);
