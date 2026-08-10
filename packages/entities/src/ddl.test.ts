import { describe, expect, test } from 'bun:test';
import type { SerializedField } from '@repo/pages';
import {
  columnType,
  createTableSql,
  entityResourceName,
  entityTableName,
  fieldColumns,
  foreignKeyDdl,
  foreignKeys,
  isValidIdentifier,
  NO_REFERENCE_TABLES,
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
    const sql = createTableSql(
      'article',
      false,
      {
        titre: { kind: 'text', maxLength: 200, required: true },
        vues: { kind: 'number', integer: true },
      },
      NO_REFERENCE_TABLES,
    );

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
    const sql = createTableSql('cgv', true, { corps: { kind: 'richText' } }, NO_REFERENCE_TABLES);

    expect(sql).toContain('singleton boolean not null default true unique check (singleton)');
    expect(sql).not.toContain('slug');
  });
});

// Clés étrangères (ADR-0045) — c'est l'argument qui a fait écarter le jsonb : pour un graphe
// d'entités qui se référencent, les garanties de la base sont l'infrastructure. Une garantie
// applicative ne protège que de l'intérieur, et un `psql` écrit sans passer par l'API.
describe('clés étrangères', () => {
  const tables = { media: 'media', targets: { product: 'product', page: 'page' } };

  test('un champ image vise la table des médias', () => {
    expect(foreignKeys({ photo: { kind: 'image' } }, tables)).toEqual([
      { column: 'photo', table: 'media', onDelete: 'set null' },
    ]);
  });

  test('un champ ref vise la table déclarée par sa cible', () => {
    expect(foreignKeys({ vedette: { kind: 'ref', to: 'product' } }, tables)).toEqual([
      { column: 'vedette', table: 'product', onDelete: 'set null' },
    ]);
  });

  // LA règle d'ADR-0045 : la politique ne se règle pas, elle se déduit. Une colonne NOT NULL ne
  // peut pas devenir nulle — `restrict` énonce ce que `set null` ferait échouer de toute façon.
  test('un champ obligatoire RETIENT sa cible, un champ optionnel se vide', () => {
    const derived = foreignKeys(
      {
        illustration: { kind: 'image' },
        couverture: { kind: 'image', required: true },
        lie: { kind: 'ref', to: 'product' },
        parent: { kind: 'ref', to: 'page', required: true },
      },
      tables,
    );

    expect(derived.map((key) => [key.column, key.onDelete])).toEqual([
      ['illustration', 'set null'],
      ['couverture', 'restrict'],
      ['lie', 'set null'],
      ['parent', 'restrict'],
    ]);
  });

  test("une cible qui n'a pas dit où elle vit ne produit aucune contrainte", () => {
    // Le silence est un état NORMAL : une cible adossée à une vue ou à un système externe reste
    // légitime. Son champ garde un `uuid` nu — le comportement d'avant ADR-0045.
    expect(foreignKeys({ lien: { kind: 'ref', to: 'externe' } }, tables)).toEqual([]);
  });

  test("sans table de médias connue, un champ image reste un uuid nu plutôt qu'un refus", () => {
    expect(foreignKeys({ photo: { kind: 'image' } }, { targets: {} })).toEqual([]);
  });

  test('les champs qui vivent en jsonb restent hors de portée', () => {
    // `list`, `repeater`, `component` : aucune clé étrangère ne sait atteindre l'intérieur d'un
    // jsonb. Dette nommée dans ADR-0045, pas un oubli.
    const derived = foreignKeys(
      {
        blocs: { kind: 'list', of: 'bloc' },
        galerie: { kind: 'repeater', fields: { image: { kind: 'image' } } },
      },
      tables,
    );

    expect(derived).toEqual([]);
  });

  test('refuse une table de cible qui ne passe pas la liste blanche', () => {
    // Le nom vient du schéma Drizzle, pas d'un fichier du dev — mais il entre dans du DDL au même
    // titre. On ne se demande pas d'où il vient.
    expect(() =>
      foreignKeys({ lien: { kind: 'ref', to: 'x' } }, { targets: { x: 'a"; drop' } }),
    ).toThrow('Table de cible refusée');
  });

  test('la contrainte est anonyme : c’est Postgres qui la nomme', () => {
    // Un nom fabriqué ici dépasserait 63 octets pour une entité au nom long, serait tronqué en
    // silence, et la comparaison au schéma réel porterait sur un nom qui ne correspond plus.
    expect(foreignKeyDdl({ column: 'photo', table: 'media', onDelete: 'set null' })).toBe(
      'foreign key (photo) references media(id) on delete set null',
    );
  });

  test('la table créée porte ses contraintes', () => {
    const sql = createTableSql(
      'article',
      false,
      {
        titre: { kind: 'text', required: true },
        photo: { kind: 'image' },
        vedette: { kind: 'ref', to: 'product', required: true },
      },
      tables,
    );

    expect(sql).toContain('foreign key (photo) references media(id) on delete set null');
    expect(sql).toContain('foreign key (vedette) references product(id) on delete restrict');
  });
});
