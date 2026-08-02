import {
  boolean,
  decimal,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { order } from './orders';

export const shipmentStatusEnum = pgEnum('shipment_status', [
  'pending',
  'label_created',
  'shipped',
  'in_transit',
  'delivered',
  'returned',
]);
export const shippingProviderTypeEnum = pgEnum('shipping_provider_type', [
  'colissimo',
  'mondialrelay',
  'sendcloud',
]);

// Configuration des providers de livraison (credentials chiffrés)
export const shippingProviderConfig = pgTable('shipping_provider_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: shippingProviderTypeEnum('provider').unique().notNull(),
  isEnabled: boolean('is_enabled').notNull().default(false),
  credentials: text('credentials'), // Chiffré AES-256-GCM
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});

export const shippingProvider = pgTable('shipping_provider', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull(), // Colissimo, Sendcloud...
  type: varchar('type', { length: 50 }).notNull(), // colissimo, sendcloud, boxtal...
  isEnabled: boolean('is_enabled').notNull().default(true),
});

export const shipment = pgTable('shipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  order: uuid('order')
    .unique()
    .notNull()
    .references(() => order.id), // One-to-one
  provider: uuid('provider')
    .notNull()
    .references(() => shippingProvider.id),
  status: shipmentStatusEnum('status').notNull().default('pending'),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  trackingUrl: varchar('tracking_url', { length: 500 }),
  weight: decimal('weight', { precision: 10, scale: 3 }),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});
