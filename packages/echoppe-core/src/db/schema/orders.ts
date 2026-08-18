import {
  decimal,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { variant } from './catalog';
import { customer } from './customer';

/**
 * L'adresse figée au moment de la commande — elle ne suit pas les modifications du carnet.
 *
 * Elle est décrite d'après ce que le checkout ÉCRIT, seule source réelle. La facture, elle,
 * affirmait une autre forme à la lecture : `company` et `street2` optionnels au lieu de nullables,
 * `phone` ignoré, et surtout `country` en chaîne alors que c'est un objet. Le pays d'une facture
 * émise valait donc `[object Object]`, sans que rien ne le signale.
 */
export interface BillingAddress {
  firstName: string;
  lastName: string;
  company: string | null;
  street: string;
  street2: string | null;
  postalCode: string;
  city: string;
  country: { code: string; name: string };
  phone: string | null;
}

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

export const order = pgTable('order', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNumber: varchar('order_number', { length: 20 }).unique().notNull(), // CMD-2025-00001
  customer: uuid('customer')
    .notNull()
    .references(() => customer.id),
  status: orderStatusEnum('status').notNull().default('pending'),
  shippingAddress: jsonb('shipping_address').notNull(), // Snapshot
  billingAddress: jsonb('billing_address').$type<BillingAddress>().notNull(),
  subtotalHt: decimal('subtotal_ht', { precision: 10, scale: 2 }).notNull(),
  shippingHt: decimal('shipping_ht', { precision: 10, scale: 2 }).notNull().default('0'),
  discountHt: decimal('discount_ht', { precision: 10, scale: 2 }).notNull().default('0'),
  totalHt: decimal('total_ht', { precision: 10, scale: 2 }).notNull(),
  totalTax: decimal('total_tax', { precision: 10, scale: 2 }).notNull(),
  totalTtc: decimal('total_ttc', { precision: 10, scale: 2 }).notNull(),
  customerNote: text('customer_note'),
  internalNote: text('internal_note'),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});

export const orderItem = pgTable('order_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  order: uuid('order')
    .notNull()
    .references(() => order.id),
  variant: uuid('variant').references(() => variant.id), // Nullable if variant deleted
  label: varchar('label', { length: 255 }).notNull(), // Moon Ring — Silver / 52
  quantity: integer('quantity').notNull(),
  unitPriceHt: decimal('unit_price_ht', { precision: 10, scale: 2 }).notNull(),
  // Personnalisation (ADR-0010) : valeurs saisies + supplément unitaire snapshoté. addonPriceHt
  // s'ajoute à unitPriceHt dans les totaux de ligne.
  personalization: jsonb('personalization').$type<Record<string, string>>(),
  addonPriceHt: decimal('addon_price_ht', { precision: 10, scale: 2 }).notNull().default('0.00'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).notNull(),
  totalHt: decimal('total_ht', { precision: 10, scale: 2 }).notNull(),
  totalTtc: decimal('total_ttc', { precision: 10, scale: 2 }).notNull(),
});
