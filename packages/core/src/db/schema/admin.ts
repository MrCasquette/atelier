import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { role } from './auth';

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
