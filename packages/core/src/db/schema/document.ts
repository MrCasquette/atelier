import { decimal, jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { media } from './media';
import { order } from './orders';

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
  sellerSnapshot: jsonb('seller_snapshot').notNull(), // Company info figée
  buyerSnapshot: jsonb('buyer_snapshot').notNull(), // Customer info figée
  totalHt: decimal('total_ht', { precision: 10, scale: 2 }).notNull(),
  totalTax: decimal('total_tax', { precision: 10, scale: 2 }).notNull(),
  totalTtc: decimal('total_ttc', { precision: 10, scale: 2 }).notNull(),
  taxExemptMention: varchar('tax_exempt_mention', { length: 255 }), // Art. 293 B...
  dateIssued: timestamp('date_issued', { withTimezone: true }).notNull().defaultNow(),
  dateDue: timestamp('date_due', { withTimezone: true }), // Échéance paiement
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
});
