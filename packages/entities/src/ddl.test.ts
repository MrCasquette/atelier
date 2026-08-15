import { describe, expect, test } from 'bun:test';
import type { SerializedField } from '@repo/fields';
import {
  addColumnSql,
  columnType,
  createTableSql,
  dropColumnSql,
  dropTableSql,
  entityResourceName,
  entityTableName,
  fieldColumns,
  foreignKeyDdl,
  foreignKeys,
  identityColumns,
  isValidIdentifier,
  isValidTableName,
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
    expect(() => fieldColumns([{ name: 'x"; drop table page', kind: 'text' }])).toThrow(/refusé/);
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
    [{ name: 'champ', kind: 'text' }, 'text'],
    [{ name: 'champ', kind: 'text', maxLength: 200 }, 'varchar(200)'],
    [{ name: 'champ', kind: 'richText' }, 'text'],
    [{ name: 'champ', kind: 'number' }, 'numeric'],
    [{ name: 'champ', kind: 'number', integer: true }, 'integer'],
    [{ name: 'champ', kind: 'boolean' }, 'boolean'],
    [{ name: 'champ', kind: 'date' }, 'date'],
    [{ name: 'champ', kind: 'date', time: true }, 'timestamptz'],
    [{ name: 'champ', kind: 'enum', options: [{ value: 'a', label: 'A' }] }, 'text'],
    [
      { name: 'champ', kind: 'enum', options: [{ value: 'a', label: 'A' }], multiple: true },
      'text[]',
    ],
    [{ name: 'champ', kind: 'image' }, 'uuid'],
    [{ name: 'champ', kind: 'ref', to: 'product' }, 'uuid'],
    [{ name: 'champ', kind: 'component', of: 'auteur' }, 'jsonb'],
    [{ name: 'champ', kind: 'list', of: 'auteur' }, 'jsonb'],
    [{ name: 'champ', kind: 'repeater', fields: [] }, 'jsonb'],
  ];

  for (const [field, expected] of cases) {
    test(`${field.kind} → ${expected}`, () => {
      expect(columnType(field)).toBe(expected);
    });
  }

  test('une longueur fractionnaire ne peut pas se glisser dans le DDL', () => {
    expect(columnType({ name: 'champ', kind: 'text', maxLength: 12.9 })).toBe('varchar(12)');
  });
});

describe('création de table', () => {
  test('une entité de liste porte un slug unique, et pas de drapeau de cardinalité', () => {
    const sql = createTableSql(
      'article',
      false,
      [
        { name: 'titre', kind: 'text', maxLength: 200, required: true },
        { name: 'vues', kind: 'number', integer: true },
      ],
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
    const sql = createTableSql(
      'cgv',
      true,
      [{ name: 'corps', kind: 'richText' }],
      NO_REFERENCE_TABLES,
    );

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
    expect(foreignKeys([{ name: 'photo', kind: 'image' }], tables)).toEqual([
      { column: 'photo', table: 'media', onDelete: 'set null' },
    ]);
  });

  test('un champ ref vise la table déclarée par sa cible', () => {
    expect(foreignKeys([{ name: 'vedette', kind: 'ref', to: 'product' }], tables)).toEqual([
      { column: 'vedette', table: 'product', onDelete: 'set null' },
    ]);
  });

  // LA règle d'ADR-0045 : la politique ne se règle pas, elle se déduit. Une colonne NOT NULL ne
  // peut pas devenir nulle — `restrict` énonce ce que `set null` ferait échouer de toute façon.
  test('un champ obligatoire RETIENT sa cible, un champ optionnel se vide', () => {
    const derived = foreignKeys(
      [
        { name: 'illustration', kind: 'image' },
        { name: 'couverture', kind: 'image', required: true },
        { name: 'lie', kind: 'ref', to: 'product' },
        { name: 'parent', kind: 'ref', to: 'page', required: true },
      ],
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
    expect(foreignKeys([{ name: 'lien', kind: 'ref', to: 'externe' }], tables)).toEqual([]);
  });

  test("sans table de médias connue, un champ image reste un uuid nu plutôt qu'un refus", () => {
    expect(foreignKeys([{ name: 'photo', kind: 'image' }], { targets: {} })).toEqual([]);
  });

  test('les champs qui vivent en jsonb restent hors de portée', () => {
    // `list`, `repeater`, `component` : aucune clé étrangère ne sait atteindre l'intérieur d'un
    // jsonb. Dette nommée dans ADR-0045, pas un oubli.
    const derived = foreignKeys(
      [
        { name: 'blocs', kind: 'list', of: 'bloc' },
        { name: 'galerie', kind: 'repeater', fields: [{ name: 'image', kind: 'image' }] },
      ],
      tables,
    );

    expect(derived).toEqual([]);
  });

  test('refuse une table de cible qui ne passe pas la liste blanche', () => {
    // Le nom vient du schéma Drizzle, pas d'un fichier du dev — mais il entre dans du DDL au même
    // titre. On ne se demande pas d'où il vient.
    expect(() =>
      foreignKeys([{ name: 'lien', kind: 'ref', to: 'x' }], { targets: { x: 'a"; drop' } }),
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
      [
        { name: 'titre', kind: 'text', required: true },
        { name: 'photo', kind: 'image' },
        { name: 'vedette', kind: 'ref', to: 'product', required: true },
      ],
      tables,
    );

    expect(sql).toContain('foreign key (photo) references media(id) on delete set null');
    expect(sql).toContain('foreign key (vedette) references product(id) on delete restrict');
  });
});

// Le chemin destructeur — `alter` et `drop` — n'était couvert par rien, là où la création l'était
// entièrement. C'est pourtant celui qui fait perdre des données : un `drop column` part sans
// confirmation dès que `planEntities` le décide, et son SQL n'a aucun moyen d'être relu ensuite.
describe('modifier une table existante', () => {
  test('ajoute une colonne nullable, même si le champ est requis', () => {
    // Une colonne ajoutée à une table qui contient déjà des lignes ne peut pas être NOT NULL sans
    // valeur par défaut. La déclaration vit avec ; refuser serait plus dur qu'utile.
    const sql = addColumnSql('article', { name: 'resume', type: 'text', notNull: true });

    expect(sql).toBe('alter table entity_article add column resume text;');
    expect(sql).not.toContain('not null');
  });

  test('retire une colonne, et une table, sur la table préfixée', () => {
    expect(dropColumnSql('article', 'resume')).toBe(
      'alter table entity_article drop column resume;',
    );
    expect(dropTableSql('article')).toBe('drop table entity_article;');
  });

  test('aucune des trois ne produit de SQL pour un nom d’entité refusé', () => {
    // La garde est `entityTableName`, partagée avec la création : un nom qui ne passe pas la liste
    // blanche lève avant toute interpolation.
    for (const bad of ['article; drop table user', 'Article', '1article', 'article-2', '']) {
      expect(() => addColumnSql(bad, { name: 'x', type: 'text', notNull: false })).toThrow();
      expect(() => dropColumnSql(bad, 'x')).toThrow();
      expect(() => dropTableSql(bad)).toThrow();
    }
  });

  test('le nom de COLONNE, lui, n’est pas validé ici — il vient d’une source déjà sûre', () => {
    // Constat volontaire, pas une recommandation. `addColumnSql` reçoit des colonnes produites par
    // `fieldColumns`, qui appelle `assertIdentifier` sur chaque champ ; `dropColumnSql` reçoit un
    // nom lu sur la table vivante. Si un troisième appelant apparaît, cette asymétrie devient un
    // trou — et ce test est ce qui le fera remarquer.
    expect(dropColumnSql('article', 'x; drop table user')).toBe(
      'alter table entity_article drop column x; drop table user;',
    );
  });

  test('une table est valide sous les mêmes règles qu’un identifiant, bornes comprises', () => {
    expect(isValidTableName('entity_article')).toBe(true);
    expect(isValidTableName('Entity')).toBe(false);
    expect(isValidTableName('')).toBe(false);
    expect(isValidTableName('a'.repeat(64))).toBe(false);
  });
});

describe('colonnes d’identité', () => {
  test('une entité de liste porte un slug, une singleton porte son drapeau verrouillé', () => {
    const list = identityColumns(false);
    const singleton = identityColumns(true);

    expect(list).toContain('slug varchar(150) not null unique');
    expect(list.some((c) => c.includes('singleton'))).toBe(false);

    expect(singleton).toContain('singleton boolean not null default true unique check (singleton)');
    expect(singleton.some((c) => c.includes('slug'))).toBe(false);
  });

  test('les deux formes portent l’identifiant et les dates, dans le même ordre', () => {
    for (const columns of [identityColumns(false), identityColumns(true)]) {
      expect(columns[0]).toBe('id uuid primary key default gen_random_uuid()');
      expect(columns.at(-2)).toBe('date_created timestamptz not null default now()');
      expect(columns.at(-1)).toBe('date_updated timestamptz not null default now()');
    }
  });
});
