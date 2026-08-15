import { media } from '@repo/assets';
import { sql } from 'drizzle-orm';
import { boolean, char, check, decimal, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

// Identité d'un site et de l'entité légale derrière lui (ADR-0040).
//
// Tout est nullable sauf `site.name` : la structure est commune aux deux produits, seule l'exigence
// diffère et elle s'exprime à la frontière de validation. Le pourquoi est dans README.md.

// Donnée de référence neutre : la liste ISO n'appartient à aucun produit (ADR-0034).
export const country = pgTable('country', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  code: char('code', { length: 2 }).unique().notNull(), // ISO 3166-1 alpha-2
});

// Le site lui-même : sa marque, son contact public, et les deux mentions que la LCEN impose à
// TOUT site — directeur de publication et hébergeur. Toujours présent, dans les deux produits.
//
// Regroupement logique assumé : des données de natures différentes, mais toutes universelles et
// toutes toujours là. C'est l'argument qu'ADR-0034 employait pour garder `company` entière, et il
// reste valable ici — ce qui l'invalidait, c'était l'appartenance à un seul produit.
export const site = pgTable(
  'site',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    singleton: boolean('singleton').notNull().default(true).unique(),

    // Marque
    name: varchar('name', { length: 255 }).notNull(),
    logo: uuid('logo').references(() => media.id, { onDelete: 'set null' }),
    url: varchar('url', { length: 255 }),
    description: varchar('description', { length: 500 }),

    // Contact public — destinataire du formulaire de contact, et point de contact des mentions
    // légales. Rattaché au site et non à l'entité légale : un site peut n'avoir aucune entité.
    publicEmail: varchar('public_email', { length: 255 }),
    publicPhone: varchar('public_phone', { length: 20 }),

    // Mentions LCEN, obligatoires même pour un particulier
    publisherName: varchar('publisher_name', { length: 255 }), // directeur de la publication
    hostName: varchar('host_name', { length: 255 }),
    hostAddress: varchar('host_address', { length: 500 }),
    hostPhone: varchar('host_phone', { length: 20 }),
  },
  (table) => [check('site_singleton', sql`${table.singleton}`)],
);

// L'entité derrière le site — personne physique ou personne morale, sans discriminant.
//
// Pas de colonne `kind` (ADR-0040) : elle devrait être renseignée par quelqu'un, et tant qu'elle ne
// l'est pas l'absence de ligne devient ambiguë — particulier sans obligation, ou professionnel qui
// n'a pas fini ? On lit la forme dans ce qui est rempli : un auto-entrepreneur laisse `legalForm`,
// `shareCapital` et `rcsCity` vides, une SASU les remplit.
//
// L'ABSENCE DE LIGNE est le signal « pas d'entité légale ». C'est la seule raison pour laquelle
// cette table est séparée de `site` : fusionnée, l'état deviendrait « toutes les colonnes nulles ».
export const legalEntity = pgTable(
  'legal_entity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    singleton: boolean('singleton').notNull().default(true).unique(),

    name: varchar('name', { length: 255 }), // raison sociale, ou prénom + nom
    legalForm: varchar('legal_form', { length: 50 }), // SASU, EURL, EI, AE… (EI et AE = personnes physiques)
    siren: varchar('siren', { length: 9 }),
    siret: varchar('siret', { length: 14 }),
    tvaIntra: varchar('tva_intra', { length: 20 }),
    rcsCity: varchar('rcs_city', { length: 100 }),
    shareCapital: decimal('share_capital', { precision: 10, scale: 2 }),

    // Siège social, ou domicile pour une personne physique assujettie
    street: varchar('street', { length: 255 }),
    street2: varchar('street_2', { length: 255 }),
    postalCode: varchar('postal_code', { length: 10 }),
    city: varchar('city', { length: 100 }),
    country: uuid('country').references(() => country.id),
  },
  (table) => [check('legal_entity_singleton', sql`${table.singleton}`)],
);
