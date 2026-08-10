import { beforeAll, describe, expect, it } from 'bun:test';
import { db, entityDefinition, permission, role, session, sql, user } from '@echoppe/core';
import { createAdminSession, migrate, req, requireSmokeDb } from './harness';

// Le chemin d'ADR-0027 : le dev déclare, la CLI pousse, l'API dérive la table. Ce qui se vérifie
// ici n'est pas « ça marche » mais les REFUS — c'est là que le mécanisme est dangereux :
//
//   - un identifiant venu d'un fichier ne doit jamais atteindre le SQL sans passer la liste blanche ;
//   - une perte de données ne doit jamais être implicite (ADR-0027) ;
//   - une table non vide ne doit jamais être supprimée, ni en cascade (ADR-0028) ;
//   - la contrainte de cardinalité doit vraiment tenir, en base et pas dans le code (ADR-0039).
//
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

let ownerCookie: string;
let editorCookie: string;

type Fields = Record<string, unknown>;
type Declaration = { name: string; singleton: boolean; fields: Fields; label?: string };
type Plan = { steps: Array<{ sql: string; destructive: boolean; summary: string }> };

const entity = (name: string, fields: Fields, singleton = false): Declaration => ({
  name,
  singleton,
  fields,
});

const registryOf = (...declarations: Declaration[]) =>
  Object.fromEntries(declarations.map((declaration) => [declaration.name, declaration]));

const push = (declarations: Declaration[], confirmDestructive = false) =>
  req('PUT', '/content/entities', {
    cookie: ownerCookie,
    body: { entities: registryOf(...declarations), confirmDestructive },
  });

const check = (declarations: Declaration[]) =>
  req('POST', '/content/entities/check', {
    cookie: ownerCookie,
    body: { entities: registryOf(...declarations) },
  });

/** Rôle qui édite le contenu à fond, et ne touche pas à sa structure. */
async function createEditorSession(): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [editorRole] = await db
    .insert(role)
    .values({ name: `Éditeur entités ${suffix}`, scope: 'admin' })
    .returning();

  await db.insert(permission).values({
    role: editorRole.id,
    resource: 'content',
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
  });

  const [editorUser] = await db
    .insert(user)
    .values({
      email: `editeur-entites-${suffix}@echoppe.test`,
      passwordHash: 'x',
      firstName: 'Éditeur',
      lastName: 'Test',
      role: editorRole.id,
      isOwner: false,
    })
    .returning();

  const token = crypto.randomUUID().replace(/-/g, '');
  await db
    .insert(session)
    .values({ token, user: editorUser.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return `echoppe_admin_session=${token}`;
}

const tableExists = async (table: string): Promise<boolean> => {
  const rows = await db.execute<{ exists: boolean }>(sql`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = ${table}
    ) as exists
  `);
  return rows[0]?.exists === true;
};

const columnsOf = async (table: string): Promise<string[]> => {
  const rows = await db.execute<{ column_name: string }>(sql`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
  `);
  return rows.map((row) => row.column_name).sort();
};

beforeAll(async () => {
  await migrate();
  ownerCookie = await createAdminSession();
  editorCookie = await createEditorSession();
  // Chaque test repart d'un journal vide : le push est remplace-tout, il n'y a pas d'état partagé
  // à préserver entre les cas.
  await db.delete(entityDefinition);
});

describe('pousser une entité dérive sa table', () => {
  it('crée la table avec ses colonnes et son journal', async () => {
    const res = await push([
      entity('article', {
        titre: { kind: 'text', maxLength: 200, required: true },
        vues: { kind: 'number', integer: true },
      }),
    ]);

    expect(res.status).toBe(200);
    expect(await tableExists('entity_article')).toBe(true);
    expect(await columnsOf('entity_article')).toEqual([
      'date_created',
      'date_updated',
      'id',
      'slug',
      'titre',
      'vues',
    ]);

    const journal = await db.select().from(entityDefinition);
    expect(journal.map((row) => row.name)).toEqual(['article']);

    // Le journal est aussi ce que l'API rend : c'est lui qui répond à « cette entité existe-t-elle ».
    const read = await req('GET', '/content/entities', { cookie: ownerCookie });
    expect(read.status).toBe(200);
    expect(Object.keys((await read.json()) as Record<string, unknown>)).toEqual(['article']);
  });

  it('ajoute une colonne sans toucher aux données existantes', async () => {
    await db.execute(sql`insert into entity_article (slug, titre) values ('un', 'Un')`);

    const planned = await check([
      entity('article', {
        titre: { kind: 'text', maxLength: 200, required: true },
        vues: { kind: 'number', integer: true },
        chapo: { kind: 'text' },
      }),
    ]);
    const plan = (await planned.json()) as Plan;
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].destructive).toBe(false);
    expect(plan.steps[0].sql).toContain('add column chapo');

    const res = await push([
      entity('article', {
        titre: { kind: 'text', maxLength: 200, required: true },
        vues: { kind: 'number', integer: true },
        chapo: { kind: 'text' },
      }),
    ]);

    expect(res.status).toBe(200);
    expect(await columnsOf('entity_article')).toContain('chapo');
    const rows = await db.execute<{ titre: string }>(sql`select titre from entity_article`);
    expect(rows.map((row) => row.titre)).toEqual(['Un']);
  });

  it("refuse de retirer une colonne sans confirmation, et dit ce qu'elle emporterait", async () => {
    const res = await push([
      entity('article', {
        titre: { kind: 'text', maxLength: 200, required: true },
        vues: { kind: 'number', integer: true },
      }),
    ]);

    expect(res.status).toBe(409);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain('chapo');
    expect(await columnsOf('entity_article')).toContain('chapo');
  });

  it('la retire quand on le demande explicitement', async () => {
    const res = await push(
      [
        entity('article', {
          titre: { kind: 'text', maxLength: 200, required: true },
          vues: { kind: 'number', integer: true },
        }),
      ],
      true,
    );

    expect(res.status).toBe(200);
    expect(await columnsOf('entity_article')).not.toContain('chapo');
  });
});

describe('ce que le mécanisme doit refuser', () => {
  it("n'exécute pas un nom d'entité hostile — il le refuse", async () => {
    const res = await push([entity('article"; drop table page; --', { titre: { kind: 'text' } })]);

    expect(res.status).toBe(422);
    // La preuve tient à ce qui a survécu, pas au message : le SQL n'est jamais parti.
    expect(await tableExists('page')).toBe(true);
  });

  it('refuse un nom de champ hostile de la même façon', async () => {
    const res = await push([entity('brouillon', { 'x"; drop table page; --': { kind: 'text' } })]);

    expect(res.status).toBe(422);
    expect(await tableExists('page')).toBe(true);
    expect(await tableExists('entity_brouillon')).toBe(false);
  });

  it("ne supprime pas une entité dont la table n'est pas vide", async () => {
    // « Supprimer » est le geste rare, et il est gardé (ADR-0028). Jamais de cascade par défaut.
    const res = await push([], true);

    expect(res.status).toBe(422);
    expect((await res.json()) as { message: string }).toMatchObject({
      message: expect.stringContaining('article'),
    });
    expect(await tableExists('entity_article')).toBe(true);
  });

  it('la supprime une fois vidée', async () => {
    await db.execute(sql`delete from entity_article`);

    const res = await push([], true);

    expect(res.status).toBe(200);
    expect(await tableExists('entity_article')).toBe(false);
    expect(await db.select().from(entityDefinition)).toEqual([]);
  });
});

describe('cardinalité', () => {
  it("un singleton n'accepte pas de seconde ligne — c'est Postgres qui refuse", async () => {
    const created = await push([entity('cgv', { corps: { kind: 'richText' } }, true)]);
    expect(created.status).toBe(200);

    // Borne HAUTE seulement : aucune ligne n'est créée à l'activation (ADR-0039).
    const empty = await db.execute<{ total: number }>(
      sql`select count(*)::int as total from entity_cgv`,
    );
    expect(empty[0].total).toBe(0);

    await db.execute(sql`insert into entity_cgv (corps) values ('v1')`);

    // La garantie est en base, pas dans le code : c'est Postgres qui doit refuser la seconde ligne.
    const second = await db
      .execute(sql`insert into entity_cgv (corps) values ('v2')`)
      .then(() => 'acceptée')
      .catch(() => 'refusée');
    expect(second).toBe('refusée');
  });

  it('refuse un changement de cardinalité sur une table qui contient des lignes', async () => {
    const res = await push([entity('cgv', { corps: { kind: 'richText' } }, false)], true);

    expect(res.status).toBe(422);
    expect((await res.json()) as { message: string }).toMatchObject({
      message: expect.stringContaining('cardinalité'),
    });
  });
});

describe('qui peut pousser', () => {
  it('refuse un éditeur : dériver une table est un acte de structure', async () => {
    const res = await req('PUT', '/content/entities', {
      cookie: editorCookie,
      body: { entities: {} },
    });

    expect(res.status).toBe(403);
  });

  it('refuse aussi la lecture du journal à qui ne détient pas `schema`', async () => {
    const res = await req('GET', '/content/entities', { cookie: editorCookie });

    expect(res.status).toBe(403);
  });
});
