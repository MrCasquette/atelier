import { media } from '@repo/assets';
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { variant } from './catalog';
import { country } from './referential';

export const addressTypeEnum = pgEnum('address_type', ['billing', 'shipping']);

export const customer = pgTable('customer', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  avatar: uuid('avatar').references(() => media.id, { onDelete: 'set null' }),
  emailVerified: boolean('email_verified').notNull().default(false),
  marketingOptin: boolean('marketing_optin').notNull().default(false),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
  lastLogin: timestamp('last_login', { withTimezone: true }),
});

// Jeton de réinitialisation de mot de passe (usage unique, TTL court). On stocke le HASH
// SHA-256 du jeton, pas le jeton brut (envoyé seulement dans l'email au client).
export const passwordResetToken = pgTable('password_reset_token', {
  id: uuid('id').primaryKey().defaultRandom(),
  customer: uuid('customer')
    .notNull()
    .references(() => customer.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
});

export const address = pgTable('address', {
  id: uuid('id').primaryKey().defaultRandom(),
  customer: uuid('customer')
    .notNull()
    .references(() => customer.id),
  type: addressTypeEnum('type').notNull(),
  label: varchar('label', { length: 50 }), // Home, Office...
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  company: varchar('company', { length: 100 }),
  street: varchar('street', { length: 255 }).notNull(),
  street2: varchar('street_2', { length: 255 }),
  postalCode: varchar('postal_code', { length: 10 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  country: uuid('country')
    .notNull()
    .references(() => country.id),
  phone: varchar('phone', { length: 20 }),
  isDefault: boolean('is_default').notNull().default(false),
});

export const wishlistItem = pgTable(
  'wishlist_item',
  {
    customer: uuid('customer')
      .notNull()
      .references(() => customer.id),
    variant: uuid('variant')
      .notNull()
      .references(() => variant.id),
    dateAdded: timestamp('date_added', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.customer, table.variant] })],
);

export const customerSession = pgTable(
  'customer_session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: varchar('token', { length: 64 }).unique().notNull(),
    customer: uuid('customer')
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('customer_session_customer_idx').on(table.customer),
    index('customer_session_token_idx').on(table.token),
  ],
);
