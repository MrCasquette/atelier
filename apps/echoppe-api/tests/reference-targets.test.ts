import { beforeAll, describe, expect, it } from 'bun:test';
import { db, eq, menu, page } from '@echoppe/core';
import { createAdminSession, getJson, migrate, req, requireDisposableDb } from './harness';

// Filet posé AVEC l'ouverture de `RefTarget` en registre (ADR-0032, #8).
//
// Avant, la cible d'un lien était une union fermée dans le contrat : le typage refusait
// `'chaussette'` avant même d'atteindre un handler. En l'ouvrant à `string`, on déplace cette
// garantie de la GRAMMAIRE vers le REGISTRE — et si le déplacement est mal fait, on n'échange pas
// un couplage contre de la souplesse, on l'échange contre une régression silencieuse : la faute de
// frappe entre en base et ne se voit qu'au read, en lien mort.
//
// Ces tests vérifient les deux moitiés du contrat déplacé : ce qui doit encore être refusé à
// l'écriture, et ce qui doit encore être résolu à la lecture.
//
// ⚠️ Base JETABLE via `bun run test:api` uniquement.
requireDisposableDb();

type TargetSummary = { name: string; label: string; route: string | null };
type Projection = { id: string; slug: string; name: string };
type ResolvedMenu = {
  items: Array<{
    label: string;
    link: { target: string; url?: string; entity?: Projection | null };
  }>;
};

let adminCookie: string;
let pageId: string;
let menuId: string;

beforeAll(async () => {
  await migrate();
  adminCookie = await createAdminSession();

  const suffix = crypto.randomUUID().slice(0, 8);
  const [createdPage] = await db
    .insert(page)
    .values({ slug: `cible-${suffix}`, title: `Cible ${suffix}`, status: 'published' })
    .returning();
  pageId = createdPage.id;

  const [createdMenu] = await db
    .insert(menu)
    .values({ handle: `nav-${suffix}`, label: 'Nav test' })
    .returning();
  menuId = createdMenu.id;
});

describe('registre de cibles référençables', () => {
  it("déclare les cibles d'Échoppe avec leur route, sans que l'admin les connaisse", async () => {
    const targets = await getJson<TargetSummary[]>('/content/reference-targets', {
      cookie: adminCookie,
    });

    expect(targets.map((target) => target.name).sort()).toEqual([
      'category',
      'collection',
      'page',
      'product',
    ]);
    expect(targets.find((target) => target.name === 'product')?.route).toBe('/produits/:slug');
  });

  it('cherche et projette une entité sans nommer sa table', async () => {
    const found = await getJson<Projection[]>('/content/reference-targets/page/entities', {
      cookie: adminCookie,
    });
    expect(found).toEqual([]);

    const projected = await getJson<Projection[]>(
      `/content/reference-targets/page/entities?ids=${pageId}`,
      { cookie: adminCookie },
    );
    expect(projected.map((entity) => entity.id)).toEqual([pageId]);
  });

  it('404 sur une cible non inscrite, plutôt qu’une liste vide qui mentirait', async () => {
    const res = await req('GET', '/content/reference-targets/chaussette/options', {
      cookie: adminCookie,
    });
    expect(res.status).toBe(404);
  });
});

describe("menu — la validation que l'union fermée assurait", () => {
  it('refuse une cible non inscrite en 422, en la nommant', async () => {
    const res = await req('PUT', `/content/menus/${menuId}`, {
      cookie: adminCookie,
      body: {
        items: [{ label: 'Faute', link: { target: 'chaussette', value: pageId }, children: [] }],
      },
    });

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      fault: { code: 'unknown_reference_targets', targets: ['chaussette'] },
    });
  });

  it('refuse aussi une cible fautive nichée dans les enfants', async () => {
    const res = await req('PUT', `/content/menus/${menuId}`, {
      cookie: adminCookie,
      body: {
        items: [
          {
            label: 'Racine',
            link: { target: 'url', value: 'https://exemple.test' },
            children: [
              { label: 'Enfant', link: { target: 'chaussette', value: pageId }, children: [] },
            ],
          },
        ],
      },
    });

    expect(res.status).toBe(422);
  });

  it('accepte une cible inscrite et la résout au read storefront', async () => {
    const written = await req('PUT', `/content/menus/${menuId}`, {
      cookie: adminCookie,
      body: {
        items: [
          { label: 'Vers la page', link: { target: 'page', value: pageId }, children: [] },
          {
            label: 'Externe',
            link: { target: 'url', value: 'https://exemple.test' },
            children: [],
          },
        ],
      },
    });
    expect(written.status).toBe(200);

    const [row] = await db.select().from(menu).where(eq(menu.id, menuId));
    const resolved = await getJson<ResolvedMenu>(`/menus/by-handle/${row.handle}`);

    expect(resolved.items[0].link.entity?.id).toBe(pageId);
    expect(resolved.items[1].link.url).toBe('https://exemple.test');
  });
});
