import { integer, jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { variant } from './catalog';
import { customer } from './customer';

export const cartStatusEnum = pgEnum('cart_status', ['active', 'converted', 'abandoned']);

export const cart = pgTable('cart', {
  id: uuid('id').primaryKey().defaultRandom(),
  customer: uuid('customer').references(() => customer.id), // Nullable if anonymous
  sessionId: varchar('session_id', { length: 100 }), // For anonymous cart
  status: cartStatusEnum('status').notNull().default('active'),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});

export const cartItem = pgTable('cart_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  cart: uuid('cart')
    .notNull()
    .references(() => cart.id),
  variant: uuid('variant')
    .notNull()
    .references(() => variant.id),
  quantity: integer('quantity').notNull(),
  // Valeurs de personnalisation saisies (ADR-0010) : { <personalizationFieldId>: "Lucie" }. null si
  // aucune. Pas de unique(cart, variant) : deux personnalisations d'une même variante = deux lignes ;
  // le merge par variante ne s'applique qu'aux lignes SANS personnalisation (géré dans la route).
  personalization: jsonb('personalization').$type<Record<string, string>>(),
  dateAdded: timestamp('date_added', { withTimezone: true }).notNull().defaultNow(),
});
