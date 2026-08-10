import { boolean, decimal, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

// Commerce pur (ADR-0034) — sorti de `referential.ts`, qui ne garde que la donnée neutre.
export const taxRate = pgTable('tax_rate', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).unique().notNull(), // TVA 20%, Franchise en base...
  rate: decimal('rate', { precision: 5, scale: 2 }).notNull(), // 20.00 for 20%
  isDefault: boolean('is_default').notNull().default(false),
  mention: varchar('mention', { length: 255 }), // TVA non applicable, art. 293 B du CGI
});
