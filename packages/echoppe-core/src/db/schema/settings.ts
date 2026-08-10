import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

// Réglages applicatifs propres à la BOUTIQUE (ADR-0034). Ils vivaient dans `company`, qui mêlait
// l'identité de l'entreprise — dont Prisme a besoin intégralement — et la numérotation des
// documents commerciaux, qui n'a de sens que pour Échoppe.
//
// Singleton borné en haut (ADR-0039) : au plus une ligne, garantie par Postgres. La ligne est
// créée paresseusement à la première lecture (cf. services/store-settings.ts) — la facturation a
// besoin d'un compteur persistant, contrairement à une fiche de contenu.
export const storeSettings = pgTable(
  'store_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    singleton: boolean('singleton').notNull().default(true).unique(),
    documentPrefix: varchar('document_prefix', { length: 10 }).notNull().default('REC'),
    documentNextNumber: integer('document_next_number').notNull().default(1),
    invoicePrefix: varchar('invoice_prefix', { length: 10 }).notNull().default('FA'),
    invoiceNextNumber: integer('invoice_next_number').notNull().default(1),
    taxExempt: boolean('tax_exempt').notNull().default(false),
  },
  (table) => [check('store_settings_singleton', sql`${table.singleton}`)],
);
