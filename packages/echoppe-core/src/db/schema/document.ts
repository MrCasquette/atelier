import { media } from '@repo/assets';
import { decimal, jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { order } from './orders';

// Snapshots figés au moment de l'émission : une facture ne se recalcule pas, elle se relit telle
// qu'elle a été émise. Leur forme est déclarée ICI, sur la colonne qui les porte, plutôt qu'affirmée
// à chaque lecture — l'affirmation reste une affirmation, mais elle est faite une fois, au seul
// endroit qui définit la donnée, et elle vaut aussi à l'écriture.
export interface SellerSnapshot {
  shopName: string;
  legalName: string;
  legalForm: string | null;
  siren: string | null;
  siret: string | null;
  tvaIntra: string | null;
  rcsCity: string | null;
  shareCapital: string | null;
  street: string;
  street2: string | null;
  postalCode: string;
  city: string;
  country: string;
  publicEmail: string;
  publicPhone: string | null;
}

export interface BuyerSnapshot {
  firstName: string;
  lastName: string;
  company: string | null;
  email: string | null;
  street: string;
  street2: string | null;
  postalCode: string;
  city: string;
  country: string | null;
}

export const documentTypeEnum = pgEnum('document_type', ['receipt', 'credit_note']);
export const invoiceTypeEnum = pgEnum('invoice_type', ['invoice', 'credit_note']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['pending', 'issued', 'cancelled']);

export const orderDocument = pgTable('order_document', {
  id: uuid('id').primaryKey().defaultRandom(),
  order: uuid('order')
    .notNull()
    .references(() => order.id),
  type: documentTypeEnum('type').notNull(),
  number: varchar('number', { length: 20 }).notNull(), // REC-2025-00001
  pdf: uuid('pdf').references(() => media.id, { onDelete: 'set null' }),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
});

export const invoice = pgTable('invoice', {
  id: uuid('id').primaryKey().defaultRandom(),
  order: uuid('order')
    .notNull()
    .references(() => order.id),
  type: invoiceTypeEnum('type').notNull(),
  number: varchar('number', { length: 20 }).notNull(), // FA-2025-00001
  status: invoiceStatusEnum('status').notNull().default('pending'),
  pdf: uuid('pdf').references(() => media.id, { onDelete: 'set null' }),
  // Snapshot légal au moment de l'émission
  sellerSnapshot: jsonb('seller_snapshot').$type<SellerSnapshot>().notNull(),
  buyerSnapshot: jsonb('buyer_snapshot').$type<BuyerSnapshot>().notNull(),
  totalHt: decimal('total_ht', { precision: 10, scale: 2 }).notNull(),
  totalTax: decimal('total_tax', { precision: 10, scale: 2 }).notNull(),
  totalTtc: decimal('total_ttc', { precision: 10, scale: 2 }).notNull(),
  taxExemptMention: varchar('tax_exempt_mention', { length: 255 }), // Art. 293 B...
  dateIssued: timestamp('date_issued', { withTimezone: true }).notNull().defaultNow(),
  dateDue: timestamp('date_due', { withTimezone: true }), // Échéance paiement
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
});
