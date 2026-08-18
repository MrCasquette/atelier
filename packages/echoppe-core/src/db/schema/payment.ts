import type { SettledPaymentStatus } from '../../adapters/payment/types';
import {
  boolean,
  decimal,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { order } from './orders';

export const paymentProviderEnum = pgEnum('payment_provider', [
  'stripe',
  'paypal',
  'bank_transfer',
  'check',
]);
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'completed',
  'failed',
  'refunded',
]);

// Configuration des providers de paiement (credentials chiffrés)
export const paymentProviderConfig = pgTable('payment_provider_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: paymentProviderEnum('provider').unique().notNull(),
  isEnabled: boolean('is_enabled').notNull().default(false),
  credentials: text('credentials'), // Chiffré AES-256-GCM (JSON stringifié puis chiffré)
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});

export const payment = pgTable('payment', {
  id: uuid('id').primaryKey().defaultRandom(),
  order: uuid('order')
    .unique()
    .notNull()
    .references(() => order.id), // One-to-one
  provider: paymentProviderEnum('provider').notNull(),
  status: paymentStatusEnum('status').notNull().default('pending'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  providerTransactionId: varchar('provider_transaction_id', { length: 255 }),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});

// Ce qui ARRIVE à un paiement — un événement, pas un statut. Le vocabulaire est dérivé de ce que
// le code écrit réellement, jamais d'un commentaire : la colonne était un `varchar` libre annonçant
// « attempt, success, failure, refund, dispute », dont deux valeurs n'ont jamais été écrites, tandis
// que `checkout_created` l'était sans être annoncée. Pire, le remboursement s'écrivait `refund` à un
// endroit et `refunded` à un autre — deux valeurs pour un même événement, qu'un varchar acceptait
// sans broncher (conventions § Fermer un vocabulaire).
export const paymentEventTypeEnum = pgEnum('payment_event_type', [
  'checkout_created',
  'success',
  'failure',
  'refund',
]);

export type PaymentEventType = (typeof paymentEventTypeEnum.enumValues)[number];

export const paymentEvent = pgTable('payment_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  payment: uuid('payment')
    .notNull()
    .references(() => payment.id),
  type: paymentEventTypeEnum('type').notNull(),
  data: jsonb('data'), // Raw provider payload
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Ce qu'un paiement réglé inscrit au journal.
 *
 * `Record` exhaustif, et non un ternaire : un statut ajouté à `PaymentStatus` ne compilera plus
 * tant qu'on n'aura pas dit quel événement il produit. C'est la version compilée de la règle —
 * fermer un vocabulaire, puis empêcher qu'il se rouvre en silence.
 */
export const PAYMENT_EVENT_BY_STATUS = {
  completed: 'success',
  failed: 'failure',
  refunded: 'refund',
} as const satisfies Record<SettledPaymentStatus, PaymentEventType>;
