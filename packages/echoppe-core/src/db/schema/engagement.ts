import { integer, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { product, variant } from './catalog';
import { customer } from './customer';

export const review = pgTable(
  'review',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    product: uuid('product')
      .notNull()
      .references(() => product.id),
    customer: uuid('customer')
      .notNull()
      .references(() => customer.id),
    rating: integer('rating').notNull(), // 1-5
    title: varchar('title', { length: 255 }),
    content: text('content'),
    dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.product, table.customer)],
);

export const backInStockRequest = pgTable(
  'back_in_stock_request',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    variant: uuid('variant')
      .notNull()
      .references(() => variant.id),
    customer: uuid('customer')
      .notNull()
      .references(() => customer.id),
    dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.variant, table.customer)],
);
