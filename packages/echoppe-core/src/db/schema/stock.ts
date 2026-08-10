import { integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { variant } from './catalog';

export const stockMoveTypeEnum = pgEnum('stock_move_type', [
  'sale',
  'return',
  'restock',
  'adjustment',
  'reservation',
]);

export const stockMove = pgTable('stock_move', {
  id: uuid('id').primaryKey().defaultRandom(),
  variant: uuid('variant').references(() => variant.id),
  label: varchar('label', { length: 255 }).notNull(), // Moon Ring — Silver / 52
  quantity: integer('quantity').notNull(), // Positive or negative
  type: stockMoveTypeEnum('type').notNull(),
  reference: uuid('reference'), // Order ID, adjustment...
  note: text('note'),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
});
