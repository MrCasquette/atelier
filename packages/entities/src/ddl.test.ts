import { describe, expect, test } from 'bun:test';
import type { SerializedField } from '@repo/pages';
import {
  columnType,
  createTableSql,
  entityResourceName,
  entityTableName,
  fieldColumns,
  isValidIdentifier,
} from './ddl';

// Du SQL est généré depuis des noms venus d'un fichier. Leur échappement est une question de
// sécurité au même titre que l'interpolation de variables (ADR-0027, ADR-0035) — et la réponse
// retenue n'est pas d'échapper mais de REFUSER : une liste blanche ne s'en remet jamais au
// doublage des guillemets.

describe('grammaire des identifiants', () => {
  test('accepte ce qu’une table peut porter', () => {
    expect(isValidIdentifier('article')).toBe(true);
    expect(isValidIdentifier('article_2')).toBe(true);
    expect(isValidIdentifier('a')).toBe(true);
  });

  test('refuse tout ce qui pourrait sortir de son identifiant', () => {
    for (const hostile of [
      'a"; drop table page; --',
      "a'; delete from user; --",
      'article; drop table page',
      'Article',
      'mon-article',
      'mon article',
      '2articles',
      '_article',
      '',
      'entité',
      'article\n; drop table page',
    ]) {
      expect(isValidIdentifier(hostile)).toBe(false);
    }
  });

  test('refuse un nom trop long pour Postgres, préfixe compris', () => {
    // 63 octets de limite, moins les 7 de `entity_`.
    expect(isValidIdentifier('a'.repeat(48))).toBe(true);
    expect(isValidIdentifier('a'.repeat(49))).toBe(false);
  });

  test('un nom refusé ne produit jamais de SQL', () => {
    expect(() => entityTableName('a"; drop table page; --')).toThrow(/refusé/);
    expect(() => fieldColumns({ 'x"; drop table page': { kind: 'text' } })).toThrow(/refusé/);
  });

  test('préfixe la table pour ne jamais heurter une table du cœur', () => {
    expect(entityTableName('page')).toBe('entity_page');
    expect(entityTableName('user')).toBe('entity_user');
  });

  test("nomme l'entité `entity:<nom>` là où elle est citée de l'extérieur", () => {
    // Rend la collision avec une cible native impossible par construction (ADR-0032).
    expect(entityResourceName('article')).toBe('entity:article');
  });
});

describe('type de colonne', () => {
  const cases: Array<[SerializedField, string]> = [
    [{ kind: 'text' }, 'text'],
    [{ kind: 'text', maxLength: 200 }, 'varchar(200)'],
    [{ kind: 'richText' }, 'text'],
    [{ kind: 'number' }, 'numeric'],
    [{ kind: 'number', integer: true }, 'integer'],
    [{ kind: 'boolean' }, 'boolean'],
    [{ kind: 'date' }, 'date'],
    [{ kind: 'date', time: true }, 'timestamptz'],
    [{ kind: 'enum', options: [{ value: 'a', label: 'A' }] }, 'text'],
    [{ kind: 'enum', options: [{ value: 'a', label: 'A' }], multiple: true }, 'text[]'],
    [{ kind: 'image' }, 'uuid'],
    [{ kind: 'ref', to: 'product' }, 'uuid'],
    [{ kind: 'component', of: 'auteur' }, 'jsonb'],
    [{ kind: 'list', of: 'auteur' }, 'jsonb'],
    [{ kind: 'repeater', fields: {} }, 'jsonb'],
  ];

  for (const [field, expected] of cases) {
    test(`${field.kind} → ${expected}`, () => {
      expect(columnType(field)).toBe(expected);
    });
  }

  test('une longueur fractionnaire ne peut pas se glisser dans le DDL', () => {
    expect(columnType({ kind: 'text', maxLength: 12.9 })).toBe('varchar(12)');
  });
});

describe('création de table', () => {
  test('une entité de liste porte un slug unique, et pas de drapeau de cardinalité', () => {
    const sql = createTableSql('article', false, {
      titre: { kind: 'text', maxLength: 200, required: true },
      vues: { kind: 'number', integer: true },
    });

    expect(sql).toContain('create table entity_article');
    expect(sql).toContain('slug varchar(150) not null unique');
    expect(sql).not.toContain('singleton');
    expect(sql).toContain('titre varchar(200) not null');
    expect(sql).toContain('vues integer');
    expect(sql).not.toContain('vues integer not null');
  });

  test('un singleton porte la contrainte de cardinalité, et pas de slug', () => {
    // `boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton)` : au plus UNE ligne, garanti par
    // Postgres (ADR-0039). Borne haute seulement — aucune ligne n'est créée à l'activation.
    const sql = createTableSql('cgv', true, { corps: { kind: 'richText' } });

    expect(sql).toContain('singleton boolean not null default true unique check (singleton)');
    expect(sql).not.toContain('slug');
  });
});
