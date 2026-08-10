import { beforeAll, describe, expect, it } from 'bun:test';
import { db, entityDefinition, sql } from '@echoppe/core';
import { createAdminSession, migrate, req, requireSmokeDb } from './harness';

// Clés étrangères d'une entité (ADR-0045).
//
// Le test unitaire de `ddl.ts` prouve la CHAÎNE SQL ; ici on prouve la GARANTIE — que Postgres la
// fait tenir. C'est toute la différence entre déclarer une contrainte et en avoir une : une
// vérification applicative ne protège que de l'intérieur, et ce fichier écrit délibérément en SQL
// direct, comme le feraient un `psql` ou un outil de reprise. C'est l'argument même qui a fait
// écarter le jsonb dans ADR-0027.
//
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

let ownerCookie: string;

type Fields = Record<string, unknown>;
type Declaration = { name: string; singleton: boolean; fields: Fields };
type Constraint = { column_name: string; foreign_table: string; delete_rule: string };

const entity = (name: string, fields: Fields, singleton = false): Declaration => ({
  name,
  singleton,
  fields,
});

const push = (declarations: Declaration[]) =>
  req('PUT', '/content/entities', {
    cookie: ownerCookie,
    body: {
      entities: Object.fromEntries(declarations.map((d) => [d.name, d])),
      confirmDestructive: true,
    },
  });

/** Les clés étrangères réellement portées par une table, lues dans le catalogue. */
const constraintsOf = (table: string) =>
  db.execute<Constraint>(sql`
    select kcu.column_name, ccu.table_name as foreign_table, rc.delete_rule
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
    join information_schema.referential_constraints rc
      on rc.constraint_name = tc.constraint_name
    where tc.table_name = ${table} and tc.constraint_type = 'FOREIGN KEY'
    order by kcu.column_name
  `);

const dossier = entity('dossier', {
  titre: { kind: 'text', required: true },
  illustration: { kind: 'image' },
  couverture: { kind: 'image', required: true },
  vedette: { kind: 'ref', to: 'product' },
});

beforeAll(async () => {
  await migrate();
  ownerCookie = await createAdminSession();
  // Journal vidé : le push est remplace-tout, et les tables laissées par d'autres fichiers ne le
  // concernent plus une fois qu'il ne les connaît plus (même idiome qu'entity-push).
  await db.delete(entityDefinition);

  const created = await push([dossier]);
  if (created.status !== 200) throw new Error(`Préparation impossible : push ${created.status}`);
});

describe('la table dérivée porte de vraies contraintes', () => {
  it('vise media pour un champ image, et la table déclarée par la cible pour un ref', async () => {
    expect(await constraintsOf('entity_dossier')).toEqual([
      // La politique se DÉDUIT de `required` : obligatoire → `restrict`, parce qu'une colonne
      // NOT NULL ne peut pas devenir nulle. `set null` échouerait quand même, mais sur une
      // violation de contrainte NOT NULL — le bon comportement dit de la pire façon.
      { column_name: 'couverture', foreign_table: 'media', delete_rule: 'RESTRICT' },
      { column_name: 'illustration', foreign_table: 'media', delete_rule: 'SET NULL' },
      { column_name: 'vedette', foreign_table: 'product', delete_rule: 'SET NULL' },
    ]);
  });

  it("refuse un uuid qui ne désigne rien, même écrit hors de l'API", async () => {
    const written = db
      .execute(
        sql`insert into entity_dossier (slug, titre, couverture) values ('x', 'X', ${crypto.randomUUID()})`,
      )
      .then(() => 'acceptée')
      .catch(() => 'refusée');

    expect(await written).toBe('refusée');
  });

  it("ne contraint pas une cible qui n'a pas déclaré son stockage", async () => {
    // Le silence d'une cible est un état NORMAL, pas un refus : son champ garde un `uuid` nu, et
    // le push passe (ADR-0045).
    const res = await push([
      dossier,
      entity('note_libre', { lien: { kind: 'ref', to: 'inconnue' } }),
    ]);
    expect(res.status).toBe(200);

    expect(await constraintsOf('entity_note_libre')).toEqual([]);
  });
});
