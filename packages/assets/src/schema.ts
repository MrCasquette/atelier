import {
  type AnyPgColumn,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const folder = pgTable('folder', {
  id: uuid('id').primaryKey().defaultRandom(),
  parent: uuid('parent').references((): AnyPgColumn => folder.id),
  name: varchar('name', { length: 100 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  folder: uuid('folder').references(() => folder.id),
  filenameDisk: varchar('filename_disk', { length: 255 }).notNull(), // UUID.ext on disk
  filenameOriginal: varchar('filename_original', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  alt: varchar('alt', { length: 255 }),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: integer('size').notNull(), // bytes
  width: integer('width'),
  height: integer('height'),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
});
