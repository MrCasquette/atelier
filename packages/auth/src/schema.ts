import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// Les sept tables de l'authentification et des droits. Elles forment une île : aucune ne référence
// une table d'un autre paquet, et `user` est le seul point d'entrée pour celles qui les référencent
// de l'extérieur (cf. ADR-0025 — les relations transverses sont déclarées dans le cœur).
//
// L'ancienne coupure `auth.ts` / `admin.ts` obligeait à une référence différée entre `user` et
// `role` ; les réunir la supprime.

// Surface : dans quelle application le rôle a un sens. `store` était le nom Échoppe de la surface
// publique ; un CMS a exactement la même (un visiteur non connecté lit ce qui est publié). Union
// fermée assumée : c'est le socle qui décide qu'il existe une administration et une surface
// publique, pas le produit (cf. ADR-0037, amendé).
export const roleScopeEnum = pgEnum('role_scope', ['admin', 'public']);

export const role = pgTable('role', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Identifiant stable des rôles que le CODE doit retrouver seul (`customer`, `public`). `name` est
  // affiché et renommable par l'utilisateur : le chercher par nom casse silencieusement l'auth dès
  // qu'on renomme « Client ». NULL pour tout rôle créé à la main — eux, le code ne les cherche pas.
  key: varchar('key', { length: 50 }).unique(),
  name: varchar('name', { length: 50 }).notNull(),
  description: text('description'),
  scope: roleScopeEnum('scope').notNull().default('admin'),
  isSystem: boolean('is_system').notNull().default(false), // public, customer, owner cannot be deleted
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
});

export const permission = pgTable(
  'permission',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    role: uuid('role')
      .notNull()
      .references(() => role.id),
    resource: varchar('resource', { length: 50 }).notNull(), // product, order, customer...
    canCreate: boolean('can_create').notNull().default(false),
    canRead: boolean('can_read').notNull().default(false),
    canUpdate: boolean('can_update').notNull().default(false),
    canDelete: boolean('can_delete').notNull().default(false),
    selfOnly: boolean('self_only').notNull().default(false), // Auto ownership filter
    locked: boolean('locked').notNull().default(false), // If true, permission cannot be modified by owner
  },
  (table) => [unique().on(table.role, table.resource)],
);

export const user = pgTable(
  'user',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).unique().notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    role: uuid('role')
      .notNull()
      .references(() => role.id),
    // Le propriétaire de l'installation, et la SEULE façon de l'être (ADR-0047) : il n'y a pas de
    // rôle « propriétaire ». Un rôle est une description de fonction, qu'on attribue en série ; la
    // propriété est une propriété d'une PERSONNE, transmise par un acte délibéré.
    isOwner: boolean('is_owner').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
    lastLogin: timestamp('last_login', { withTimezone: true }),
  },
  // Un seul propriétaire — et c'est Postgres qui le tient, pas une intention en commentaire. Index
  // PARTIEL : la contrainte ne porte que sur les lignes vraies, sans quoi elle interdirait le
  // second utilisateur non-propriétaire.
  (table) => [uniqueIndex('user_single_owner').on(table.isOwner).where(sql`${table.isOwner}`)],
);

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
// résolution (cf. modules/auth/rbac). Portée réduite + révocable, contrairement aux creds humaines.
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
