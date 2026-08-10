import type { SerializedField } from '@repo/pages';

// Traduction d'une déclaration d'entité en SQL. Fonctions PURES — aucune base, aucun transport :
// c'est ce qui les rend testables, et ce sont elles qu'il faut le plus tester.
//
// C'est le pendant DDL de la traduction champ → schéma TypeBox qui valide les données écrites
// (`definition-service.ts`). Même déclaration, deux dérivations : l'une dit ce qu'on accepte,
// l'autre dit où on le range.

/**
 * Grammaire d'un identifiant — nom d'entité comme nom de champ.
 *
 * Du SQL est généré depuis des noms venus d'un fichier : leur échappement est une question de
 * sécurité au même titre que l'interpolation de variables (ADR-0027, ADR-0035). On REFUSE plutôt
 * qu'on échappe. Échapper une chaîne libre, c'est accepter n'importe quoi et espérer que le
 * doublage des guillemets suffise ; une liste blanche, c'est ne jamais avoir à s'en remettre à ça.
 *
 * 48 caractères : la limite Postgres est de 63 octets, et le préfixe `entity_` en consomme 7.
 */
const IDENTIFIER = /^[a-z][a-z0-9_]*$/;
const IDENTIFIER_MAX = 48;

export function isValidIdentifier(name: string): boolean {
  return name.length > 0 && name.length <= IDENTIFIER_MAX && IDENTIFIER.test(name);
}

/**
 * Même grammaire, budget entier : une table VISÉE par une clé étrangère n'est pas dérivée d'une
 * entité, elle ne porte donc pas le préfixe `entity_` et dispose des 63 octets de Postgres.
 *
 * Ce n'est pas une seconde règle — c'est la même, appliquée à une longueur qui n'a pas la même
 * contrainte. Le nom vient du schéma Drizzle (ADR-0045) et non d'un fichier du dev, mais il entre
 * dans du DDL au même titre : on le vérifie sans se demander d'où il vient.
 */
const TABLE_MAX = 63;

export function isValidTableName(name: string): boolean {
  return name.length > 0 && name.length <= TABLE_MAX && IDENTIFIER.test(name);
}

function assertIdentifier(name: string, role: string): void {
  if (!isValidIdentifier(name)) {
    throw new Error(
      `${role} refusé : « ${name} ». Minuscules, chiffres et « _ », commençant par une lettre.`,
    );
  }
}

/** Nom de la table dérivée. Le préfixe évite toute collision avec une table du cœur. */
export function entityTableName(name: string): string {
  if (!isValidIdentifier(name)) {
    throw new Error(`Nom d'entité refusé : « ${name} ».`);
  }
  return `entity_${name}`;
}

/** Nom sous lequel une entité est citée de l'extérieur : ressource RBAC, cible référençable. */
export function entityResourceName(name: string): string {
  return `entity:${name}`;
}

// ── Colonnes ──────────────────────────────────────────────────────────────────────────────────

export type ColumnSpec = {
  name: string;
  /** Type SQL tel qu'écrit dans le DDL. */
  type: string;
  notNull: boolean;
};

/**
 * Type SQL d'un champ.
 *
 * `list`, `repeater` et un component imbriqué vont en `jsonb` : ce sont des groupes répétés ou
 * imbriqués, et les mettre en colonnes demanderait une table fille par champ — hors de ce que le
 * DSL sait dire aujourd'hui (ADR-0027, « l'expressivité est bornée »).
 *
 * `enum` va en `text` sans contrainte `CHECK` : la valeur est déjà validée à la frontière par le
 * schéma compilé depuis la même déclaration, et une contrainte nommée serait à faire évoluer à
 * chaque ajout d'option — du DDL destructeur pour une garantie qu'on a déjà.
 */
export function columnType(field: SerializedField): string {
  switch (field.kind) {
    case 'text':
      return field.maxLength ? `varchar(${Math.trunc(field.maxLength)})` : 'text';
    case 'richText':
      return 'text';
    case 'number':
      return field.integer ? 'integer' : 'numeric';
    case 'boolean':
      return 'boolean';
    case 'date':
      return field.time ? 'timestamptz' : 'date';
    case 'enum':
      return field.multiple ? 'text[]' : 'text';
    case 'image':
    case 'ref':
      // UUID de média ou d'entité référencée. La clé étrangère, elle, est une contrainte de TABLE
      // et se dérive à part (`foreignKeys`) : elle a besoin de savoir où vit la cible, ce qu'un
      // type de colonne n'a pas à connaître.
      return 'uuid';
    case 'component':
    case 'list':
    case 'repeater':
      return 'jsonb';
  }
}

/**
 * Colonnes propres à l'entité, dans l'ordre de déclaration.
 *
 * Un champ `required` devient `NOT NULL`. Conséquence assumée : rendre un champ obligatoire après
 * coup échoue si des lignes existent sans valeur — c'est Postgres qui refuse, et il a raison.
 */
export function fieldColumns(fields: Record<string, SerializedField>): ColumnSpec[] {
  const columns: ColumnSpec[] = [];
  for (const [name, field] of Object.entries(fields)) {
    assertIdentifier(name, 'Nom de champ');
    columns.push({ name, type: columnType(field), notNull: field.required === true });
  }
  return columns;
}

// ── Clés étrangères (ADR-0045) ────────────────────────────────────────────────────────────────

/**
 * Ce qu'une suppression de la cible fait à la ligne qui la vise.
 *
 * Deux valeurs seulement, et le choix ne se règle pas : il se DÉDUIT de `required`. Une colonne
 * `NOT NULL` ne peut pas devenir nulle — y déclarer `set null` n'empêcherait pas la suppression
 * d'échouer, mais sur une violation de contrainte NOT NULL : le bon comportement, dit de la pire
 * façon. `restrict` énonce l'intention, et c'est ce qui rend possible un « impossible de supprimer,
 * utilisé par 3 fiches ».
 */
export type OnDelete = 'set null' | 'restrict';

export type ForeignKeySpec = {
  /** Colonne porteuse, donc le nom du champ déclaré. */
  column: string;
  /** Table visée. Sa clé primaire est toujours `id` — aucune cible ne s'identifie autrement. */
  table: string;
  onDelete: OnDelete;
};

/**
 * Où vivent les cibles, vu du mécanisme qui écrit le DDL.
 *
 * Passé par l'appelant, jamais lu ici : ce module ne connaît ni `media` ni le registre de
 * références, et c'est ce qui lui permet de servir les deux produits. Même idiome que
 * `validateEntityData(…, components)` et `isValidScopeFor(…, entityNames)`.
 */
export type ReferenceTables = {
  /** Table des médias, pour les champs `image`. Absente → pas de clé étrangère. */
  media?: string;
  /** Table de chaque cible qui a déclaré son stockage (cf. `storageOf`). */
  targets: Record<string, string>;
};

/** Aucune cible connue : tout champ `image`/`ref` reste un `uuid` nu. */
export const NO_REFERENCE_TABLES: ReferenceTables = { targets: {} };

function targetTable(field: SerializedField, tables: ReferenceTables): string | undefined {
  if (field.kind === 'image') return tables.media;
  if (field.kind === 'ref') return tables.targets[field.to];
  return undefined;
}

/**
 * Contraintes de clé étrangère qu'implique une déclaration.
 *
 * Une cible qui n'a pas dit où elle vit est simplement absente du résultat — son champ garde un
 * `uuid` nu, comme avant ADR-0045. Le silence d'une cible est un état normal, pas un refus : ce
 * qui la rend contraignable est de déclarer son stockage, exactement comme ce qui la rend
 * référençable est d'avoir une URL (ADR-0032).
 *
 * Les champs `component`, `list` et `repeater` restent hors de portée : leur contenu vit dans du
 * jsonb, qu'aucune clé étrangère ne sait atteindre. Dette nommée dans ADR-0045.
 */
export function foreignKeys(
  fields: Record<string, SerializedField>,
  tables: ReferenceTables,
): ForeignKeySpec[] {
  const keys: ForeignKeySpec[] = [];
  for (const [name, field] of Object.entries(fields)) {
    const table = targetTable(field, tables);
    if (!table) continue;

    assertIdentifier(name, 'Nom de champ');
    if (!isValidTableName(table)) {
      throw new Error(`Table de cible refusée : « ${table} », visée par le champ « ${name} ».`);
    }

    keys.push({ column: name, table, onDelete: field.required === true ? 'restrict' : 'set null' });
  }
  return keys;
}

/**
 * La contrainte, telle qu'elle s'écrit dans un `create table`.
 *
 * Volontairement ANONYME : c'est Postgres qui la nomme. Un nom fabriqué ici — `entity_<nom>_<champ>_fkey`
 * — dépasserait les 63 octets pour un nom d'entité long, serait tronqué en silence, et la
 * comparaison au schéma réel porterait alors sur un nom qui ne correspond plus. On compare sur la
 * colonne, qui elle ne ment pas.
 */
export const foreignKeyDdl = (key: ForeignKeySpec): string =>
  `foreign key (${key.column}) references ${key.table}(id) on delete ${key.onDelete}`;

/**
 * Colonnes que toute entité porte, quelle que soit sa déclaration.
 *
 * Un singleton n'a pas de slug — son identité est son nom (ADR-0039) — et porte à la place la
 * contrainte de cardinalité. `boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton)` : une seule
 * valeur possible, unique, donc AU PLUS une ligne, garanti par Postgres. Borne HAUTE seulement :
 * la contrainte empêche la seconde ligne, elle n'impose pas la première.
 */
export const IDENTITY_COLUMNS = ['id', 'slug', 'singleton', 'date_created', 'date_updated'];

export function identityColumns(singleton: boolean): string[] {
  return [
    'id uuid primary key default gen_random_uuid()',
    ...(singleton
      ? ['singleton boolean not null default true unique check (singleton)']
      : ['slug varchar(150) not null unique']),
    'date_created timestamptz not null default now()',
    'date_updated timestamptz not null default now()',
  ];
}

const columnDdl = (column: ColumnSpec): string =>
  `${column.name} ${column.type}${column.notNull ? ' not null' : ''}`;

export function createTableSql(
  name: string,
  singleton: boolean,
  fields: Record<string, SerializedField>,
  // Requis, sans valeur par défaut : un appelant qui oublierait l'argument produirait une table
  // sans ses garanties, en silence. Le compilateur l'oblige à dire ce qu'il vise — quitte à dire
  // `NO_REFERENCE_TABLES`, qui est alors un choix écrit et non un oubli.
  tables: ReferenceTables,
): string {
  const table = entityTableName(name);
  const lines = [
    ...identityColumns(singleton),
    ...fieldColumns(fields).map(columnDdl),
    ...foreignKeys(fields, tables).map(foreignKeyDdl),
  ];
  return `create table ${table} (\n  ${lines.join(',\n  ')}\n);`;
}

export function addColumnSql(name: string, column: ColumnSpec): string {
  // Une colonne ajoutée à une table qui contient déjà des lignes ne peut pas être `NOT NULL` sans
  // valeur par défaut : on l'ajoute nullable, et c'est à la déclaration de vivre avec. Refuser
  // serait plus dur qu'utile pour un champ qu'on vient d'inventer.
  return `alter table ${entityTableName(name)} add column ${column.name} ${column.type};`;
}

export function dropColumnSql(name: string, column: string): string {
  return `alter table ${entityTableName(name)} drop column ${column};`;
}

export function dropTableSql(name: string): string {
  return `drop table ${entityTableName(name)};`;
}
