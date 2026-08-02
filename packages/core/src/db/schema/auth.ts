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

export const roleScopeEnum = pgEnum('role_scope', ['admin', 'store']);

// Forward reference for user (defined in admin.ts)
// Session needs to reference user, but user references role
// We use a string reference to avoid circular imports

export const role = pgTable('role', {
  id: uuid('id').primaryKey().defaultRandom(),
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
