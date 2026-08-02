import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const communicationProviderEnum = pgEnum('communication_provider', [
  'resend',
  'brevo',
  'smtp',
]);

// Configuration des providers de communication (credentials chiffrés)
export const communicationProviderConfig = pgTable('communication_provider_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: communicationProviderEnum('provider').unique().notNull(),
  isEnabled: boolean('is_enabled').notNull().default(false),
  credentials: text('credentials'), // Chiffré AES-256-GCM (JSON stringifié puis chiffré)
  fromEmail: varchar('from_email', { length: 255 }),
  fromName: varchar('from_name', { length: 255 }),
  replyTo: varchar('reply_to', { length: 255 }),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});

// Log des communications envoyées (audit/debug)
export const communicationLog = pgTable('communication_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: communicationProviderEnum('provider').notNull(),
  channel: varchar('channel', { length: 20 }).notNull().default('email'), // email, sms, whatsapp (futur)
  template: varchar('template', { length: 50 }).notNull(), // order-confirmation, shipment, reset-password
  recipient: varchar('recipient', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull(), // sent, failed, bounced
  providerMessageId: varchar('provider_message_id', { length: 255 }),
  error: text('error'),
  metadata: jsonb('metadata'), // Données additionnelles (orderId, customerId, etc.)
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
});
