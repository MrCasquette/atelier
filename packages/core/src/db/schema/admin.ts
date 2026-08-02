import { media } from '@repo/assets';
import {
  boolean,
  decimal,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { role } from './auth';
import { country } from './referential';

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  role: uuid('role')
    .notNull()
    .references(() => role.id),
  isOwner: boolean('is_owner').notNull().default(false), // Only one, transferable
  isActive: boolean('is_active').notNull().default(true),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  lastLogin: timestamp('last_login', { withTimezone: true }),
});

export const session = pgTable(
  'session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: varchar('token', { length: 64 }).unique().notNull(),
    user: uuid('user')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('session_user_idx').on(table.user), index('session_token_idx').on(table.token)],
);

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  user: uuid('user').references(() => user.id), // Nullable if system action
  action: varchar('action', { length: 100 }).notNull(), // product.create, order.refund, user.login...
  entityType: varchar('entity_type', { length: 50 }), // product, order...
  entityId: uuid('entity_id'),
  data: jsonb('data'), // Contextual details
  ipAddress: varchar('ip_address', { length: 45 }),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
});

export const company = pgTable('company', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopName: varchar('shop_name', { length: 255 }).notNull(),
  logo: uuid('logo').references(() => media.id, { onDelete: 'set null' }),
  publicEmail: varchar('public_email', { length: 255 }).notNull(),
  publicPhone: varchar('public_phone', { length: 20 }),
  legalName: varchar('legal_name', { length: 255 }).notNull(),
  legalForm: varchar('legal_form', { length: 50 }), // SASU, EURL, EI, AE...
  siren: varchar('siren', { length: 9 }),
  siret: varchar('siret', { length: 14 }),
  tvaIntra: varchar('tva_intra', { length: 20 }),
  rcsCity: varchar('rcs_city', { length: 100 }),
  shareCapital: decimal('share_capital', { precision: 10, scale: 2 }),
  street: varchar('street', { length: 255 }).notNull(),
  street2: varchar('street_2', { length: 255 }),
  postalCode: varchar('postal_code', { length: 10 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  country: uuid('country')
    .notNull()
    .references(() => country.id),
  // La numérotation des documents commerciaux et la franchise de TVA vivent dans
  // `storeSettings` (schema/settings.ts) — ADR-0034 : `company` porte l'identité de l'entreprise,
  // dont Prisme a besoin intégralement, pas les réglages de facturation d'une boutique.
  // Legal pages info
  publisherName: varchar('publisher_name', { length: 255 }),
  hostingProvider: varchar('hosting_provider', { length: 255 }),
  hostingAddress: varchar('hosting_address', { length: 500 }),
  hostingPhone: varchar('hosting_phone', { length: 20 }),
});

// Clés d'API machine (P2b) : authentifient un client non-interactif (CLI, CI) via
// `Authorization: Bearer eck_…`. La clé en clair n'est JAMAIS stockée — seul son hash SHA-256.
// Les `scopes` (ex. ['read:content','write:content']) sont dérivés en permissions RBAC à la
// résolution (cf. plugins/rbac). Portée réduite + révocable, contrairement aux creds humaines.
export const apiKey = pgTable(
  'api_key',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(), // libellé lisible (« CLI DPC », « CI »)
    hash: varchar('hash', { length: 64 }).unique().notNull(), // SHA-256 hex de la clé
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }), // null = pas d'expiration
    dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('api_key_hash_idx').on(table.hash)],
);
