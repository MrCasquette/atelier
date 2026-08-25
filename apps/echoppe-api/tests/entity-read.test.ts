import { beforeAll, describe, expect, it } from 'bun:test';
import { entityDefinition } from '@repo/entities';
import { db, sql } from '@repo/db';
import {
  createAdminSession,
  migrate,
  record,
  records,
  req,
  requireDisposableDb,
} from './harness';

// Surface de lecture front des entités (ADR-0027, amendement du 2026-08-10). Deux choses s'y
// vérifient, et la seconde est celle qui compte :
//
//   - une route générique rend bien la liste et l'occurrence ;
//   - un singleton NON RENSEIGNÉ et une entité NON DÉCLARÉE ne rendent pas la même chose. Un 404
//     pour les deux les confondrait, et le front ne pourrait pas deviner laquelle il a sous les
//     yeux : l'une est une tâche à faire, l'autre est un bug (ADR-0039).
//
// ⚠️ Base JETABLE via `bun run integration echoppe api` uniquement.
requireDisposableDb();

const read = async (path: string): Promise<{ status: number; body: Record<string, unknown> }> => {
  const res = await req('GET', path);
  return { status: res.status, body: record(await res.json()) };
};

beforeAll(async () => {
  await migrate();
  const ownerCookie = await createAdminSession();
  await db.delete(entityDefinition);

  const pushed = await req('PUT', '/content/entities', {
    cookie: ownerCookie,
    body: {
      entities: {
        billet: {
          name: 'billet',
          singleton: false,
          fields: [
            { name: 'titre', kind: 'text', maxLength: 200, required: true },
            { name: 'vues', kind: 'number', integer: true },
          ],
        },
        mentions: {
          name: 'mentions',
          singleton: true,
          fields: [{ name: 'corps', kind: 'richText' }],
        },
      },
    },
  });
  if (pushed.status !== 200) {
    throw new Error(`Préparation impossible : push ${pushed.status}`);
  }

  await db.execute(
    sql`insert into entity_billet (slug, titre, vues) values ('premier', 'Premier', 3), ('second', 'Second', 7)`,
  );
});

describe("lecture d'une entité de liste", () => {
  it('rend les occurrences avec la même enveloppe que le reste de la boutique', async () => {
    const { status, body } = await read('/entities/billet');

    expect(status).toBe(200);
    expect(record(body.meta, 'meta').total).toBe(2);
    expect(record(body.meta, 'meta').hasNextPage).toBe(false);
    const rows = records(body.data, 'data');
    expect(rows.map((row) => row.titre).sort()).toEqual(['Premier', 'Second']);
  });

  it("nomme les colonnes d'identité comme le reste de l'API, et les champs comme le dev", async () => {
    const { body } = await read('/entities/billet');
    const [row] = records(body.data, 'data');

    expect(Object.keys(row).sort()).toEqual([
      'dateCreated',
      'dateUpdated',
      'id',
      'slug',
      'titre',
      'vues',
    ]);
  });

  it('pagine', async () => {
    const { body } = await read('/entities/billet?limit=1');

    expect(records(body.data, 'data').length).toBe(1);
    expect(record(body.meta, 'meta').hasNextPage).toBe(true);
  });

  it('rend une occurrence par son slug', async () => {
    const { status, body } = await read('/entities/billet/premier');

    expect(status).toBe(200);
    expect(record(body.data, 'data').titre).toBe('Premier');
  });

  it('rend 404 pour un slug qui ne désigne rien', async () => {
    const { status } = await read('/entities/billet/inexistant');

    expect(status).toBe(404);
  });
});

describe("un singleton non renseigné n'est pas une erreur", () => {
  it('rend 200 avec `data: null` — déclaré, pas encore rempli', async () => {
    const { status, body } = await read('/entities/mentions');

    expect(status).toBe(200);
    expect(body.data).toBeNull();
    // Pas de `meta` : il n'y a rien à paginer, et le front n'a pas à gérer « plusieurs ».
    expect(body.meta).toBeUndefined();
  });

  it('rend son unique occurrence une fois remplie, sans slug', async () => {
    await db.execute(sql`insert into entity_mentions (corps) values ('Éditeur : …')`);

    const { status, body } = await read('/entities/mentions');

    expect(status).toBe(200);
    expect(record(body.data, 'data').corps).toBe('Éditeur : …');
    expect(body.data).not.toHaveProperty('slug');
  });

  it('ne se lit pas par slug : son identité est son nom', async () => {
    const { status } = await read('/entities/mentions/peu-importe');

    expect(status).toBe(404);
  });
});

describe('une entité non déclarée est une erreur de code', () => {
  it('rend 404, distinct du 200 d’un singleton vide', async () => {
    const { status } = await read('/entities/chaussette');

    expect(status).toBe(404);
  });

  it('ne laisse pas un nom hostile atteindre le SQL', async () => {
    const { status } = await read('/entities/billet%22%3B%20drop%20table%20page%3B%20--');

    expect(status).toBe(404);
    const survived = await db.execute<{ exists: boolean }>(sql`
      select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'page'
      ) as exists
    `);
    expect(survived[0].exists).toBe(true);
  });
});
