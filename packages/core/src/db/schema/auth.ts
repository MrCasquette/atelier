import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// Surface : dans quelle application le rôle a un sens. `store` était le nom Échoppe de la surface
// publique ; un CMS a exactement la même (un visiteur non connecté lit ce qui est publié). Union
// fermée assumée : c'est le socle qui décide qu'il existe une administration et une surface
// publique, pas le produit (cf. ADR-0037, amendé).
export const roleScopeEnum = pgEnum('role_scope', ['admin', 'public']);

// Forward reference for user (defined in admin.ts)
// Session needs to reference user, but user references role
// We use a string reference to avoid circular imports

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
