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
      // UUID de média ou d'entité référencée. Sans clé étrangère en V1 : la table cible se déduit
      // du registre de références, qui n'expose pas de nom de table. C'est la garantie qui
      // justifiait les vraies tables (ADR-0027) — elle reste à câbler, cf. #36.
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
    if (!isValidIdentifier(name)) {
      throw new Error(
        `Nom de champ refusé : « ${name} ». Minuscules, chiffres et « _ », commençant par une lettre — il devient un nom de colonne.`,
      );
    }
    columns.push({ name, type: columnType(field), notNull: field.required === true });
  }
  return columns;
}

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
): string {
  const table = entityTableName(name);
  const lines = [...identityColumns(singleton), ...fieldColumns(fields).map(columnDdl)];
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
