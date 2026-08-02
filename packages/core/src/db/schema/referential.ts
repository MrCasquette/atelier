import { char, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

// Donnée de référence neutre (ADR-0034) : la liste ISO n'appartient à aucun produit. Le champ
// `isShippingEnabled` qui la marquait commerce est parti dans `shippingCountry` (schema/shipping.ts),
// et `taxRate` dans schema/tax.ts. Cette table est destinée au package partagé.
export const country = pgTable('country', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  code: char('code', { length: 2 }).unique().notNull(), // ISO 3166-1 alpha-2
});
