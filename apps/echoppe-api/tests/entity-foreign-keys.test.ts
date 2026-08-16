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

/** Forme d'écriture des fixtures : lisible. La déclaration poussée, elle, est une séquence. */
type Fields = Record<string, Record<string, unknown>>;
type Declaration = { name: string; singleton: boolean; fields: unknown[] };
type Constraint = { column_name: string; foreign_table: string; delete_rule: string };

// Le champ PORTE son nom depuis ADR-0049 — conversion ici pour garder les cas lisibles.
const entity = (name: string, fields: Fields, singleton = false): Declaration => ({
  name,
  singleton,
  fields: Object.entries(fields).map(([field, shape]) => ({ name: field, ...shape })),
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

// L'existant. Une installation antérieure à ADR-0045 porte des colonnes `uuid` NUES : sans cet
// alignement, elle les garderait indéfiniment et seules les entités créées ensuite auraient leurs
// garanties. La table est fabriquée ici telle que l'ancien mécanisme la produisait.
describe('une table déjà poussée se met à niveau', () => {
  const ancienne = entity('archive', {
    titre: { kind: 'text', required: true },
    visuel: { kind: 'image' },
  });

  const asBeforeAdr0045 = () =>
    db.execute(sql`
      drop table if exists entity_archive;
      create table entity_archive (
        id uuid primary key default gen_random_uuid(),
        slug varchar(150) not null unique,
        date_created timestamptz not null default now(),
        date_updated timestamptz not null default now(),
        titre text not null,
        visuel uuid
      );
    `);

  it('propose la contrainte manquante, sans la compter comme destructrice', async () => {
    await asBeforeAdr0045();
    // Le journal doit connaître l'entité, sinon le plan proposerait de créer la table.
    await push([dossier, ancienne]);
    await asBeforeAdr0045();

    const planned = await req('POST', '/content/entities/check', {
      cookie: ownerCookie,
      body: { entities: { dossier, archive: ancienne } },
    });
    const plan = (await planned.json()) as {
      steps: Array<{ sql: string; destroys?: { kind: string; target: string } }>;
      blockers: string[];
    };

    expect(plan.blockers).toEqual([]);
    const step = plan.steps.find((s) => s.sql.includes('entity_archive'));
    expect(step?.sql).toContain('add foreign key (visuel) references media(id)');
    // Poser une garantie ne détruit rien : ça passe sans confirmation.
    expect(step?.destroys).toBeUndefined();
  });

  it('applique la contrainte, qui protège ensuite pour de bon', async () => {
    const res = await push([dossier, ancienne]);
    expect(res.status).toBe(200);

    expect(await constraintsOf('entity_archive')).toEqual([
      { column_name: 'visuel', foreign_table: 'media', delete_rule: 'SET NULL' },
    ]);
  });

  it('refuse de poser la contrainte sur des valeurs pendantes, en nommant la cible', async () => {
    await asBeforeAdr0045();
    // Donnée DÉJÀ cassée, que l'absence de contrainte laissait passer. On ne l'efface pas d'office :
    // ce serait exactement la destruction implicite que le mécanisme refuse partout (ADR-0028).
    await db.execute(
      sql`insert into entity_archive (slug, titre, visuel) values ('orpheline', 'X', ${crypto.randomUUID()})`,
    );

    const res = await push([dossier, ancienne]);

    expect(res.status).toBe(422);
    // Le COMPTE de lignes ne traverse plus : il ne changeait pas le geste — corriger ces valeurs —
    // et l'appelant n'en pouvait rien faire de plus (ADR-0050 §5). La table VISÉE, si : elle ne se
    // déduit pas de la déclaration soumise.
    expect(await res.json()).toMatchObject({
      fault: {
        code: 'blocked_plan',
        blockers: [{ reason: 'dangling_rows', target: 'archive.visuel', references: 'media' }],
      },
    });
    // Rien n'a été touché : la ligne fautive est toujours là, à corriger.
    const rows = await db.execute<{ total: number }>(
      sql`select count(*)::int as total from entity_archive`,
    );
    expect(rows[0].total).toBe(1);

    // Une fois le constat fait, on rend la base à l'état où on l'a trouvée : ces fichiers partagent
    // une seule base, et une table laissée pleine bloquerait la suppression pour le suivant.
    await db.execute(sql`delete from entity_archive`);
  });
});

// Une table VISÉE par une clé étrangère ne se supprime pas. Les entités ne sont pas encore des
// cibles référençables (#29), mais la contrainte peut venir d'ailleurs — d'un `psql`, d'une table
// applicative — et c'est justement le scénario que la souveraineté des données rend normal.
describe("une entité que l'on référence ne se supprime pas", () => {
  const citee = entity('citee', { titre: { kind: 'text' } });

  it('refuse la suppression en NOMMANT ce qui retient, plutôt que de casser', async () => {
    const created = await push([dossier, citee]);
    expect(created.status).toBe(200);

    await db.execute(sql`
      drop table if exists lecteur_externe;
      create table lecteur_externe (
        id uuid primary key default gen_random_uuid(),
        cible uuid references entity_citee(id)
      );
    `);

    // `citee` disparaît de la déclaration : le plan voudrait supprimer sa table.
    const res = await push([dossier]);

    expect(res.status).toBe(422);
    // Le refus doit dire QUI retient — sans quoi la seule issue trouvable serait la cascade. C'est
    // la raison pour laquelle `still_referenced` porte `holders` là où ses voisines n'ont qu'une
    // cible : ce sont d'AUTRES tables que celle soumise, donc introuvables depuis la requête.
    expect(await res.json()).toMatchObject({
      fault: {
        code: 'blocked_plan',
        blockers: [
          { reason: 'still_referenced', target: 'citee', holders: ['lecteur_externe.cible'] },
        ],
      },
    });

    await db.execute(sql`drop table lecteur_externe`);
  });
});
