import { boolean, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

// Journal des entités activées (ADR-0028, conséquence n°2) — l'équivalent de
// `__drizzle_migrations` pour les entités : quelles entités existent, et sous quelle déclaration.
// Sans lui, on ne sait pas répondre à « cette entité a-t-elle déjà sa table ».
//
// La table d'une entité, elle, n'est PAS décrite ici : elle est dérivée de `fields` et créée en
// SQL au push (ADR-0027). Le schéma d'une installation n'est donc plus entièrement déterminé par
// les fichiers de migration, et c'est assumé — le cœur est le framework, les entités sont le
// contenu de l'utilisateur. On ne garde pas sous CI ce qui varie par installation.
//
// ⚠️ `bun run db <produit> push` compare le schéma Drizzle à la base VIVE : il proposerait de supprimer les
// tables d'entités, qu'il ne connaît pas. `db:generate` + `db:migrate`, qui ne lisent que les
// fichiers, n'ont pas ce défaut. Cf. docs-internal/architecture/entites.md.
export const entityDefinition = pgTable('entity_definition', {
  // Nom déclaré par le dev (`article`), sans le préfixe `entity:` sous lequel il est cité de
  // l'extérieur. Borné à `[a-z][a-z0-9_]*` : il devient un identifiant SQL.
  name: varchar('name', { length: 48 }).primaryKey(),
  label: varchar('label', { length: 200 }),
  icon: varchar('icon', { length: 100 }),
  // Au plus une occurrence (ADR-0039). Pilote l'UI, la forme de la route, et la contrainte posée
  // sur la table dérivée.
  singleton: boolean('singleton').notNull().default(false),
  // SÉQUENCE [{ name, kind, … }] — la déclaration elle-même, telle que poussée. C'est ce qui sert
  // de point de comparaison au prochain `check` : pas besoin d'une version à part, la déclaration
  // EST la version. L'ordre y est de l'information : c'est celui des colonnes dérivées, et celui du
  // formulaire d'administration.
  //
  // `jsonb` le préserve, parce qu'un tableau est ordonné par construction (ADR-0049). Ce n'était
  // pas le cas quand la déclaration était un objet — `jsonb` trie les clés, d'où le passage
  // temporaire à `json` sous #46, que la séquence rend caduc.
  fields: jsonb('fields').notNull(),
  // Comment l'entité produit son lien (ADR-0046) — `null` quand elle ne se cite pas, ce qui est un
  // état normal : ce qui rend une entité référençable est d'avoir une URL, pas d'être déclarée.
  // C'est cette colonne qui permet de réinscrire les cibles au démarrage, sans rejouer un push.
  link: jsonb('link'),
  dateCreated: timestamp('date_created', { withTimezone: true }).notNull().defaultNow(),
  dateUpdated: timestamp('date_updated', { withTimezone: true }).notNull().defaultNow(),
});
