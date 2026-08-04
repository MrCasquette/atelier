import { beforeAll, describe, expect, it } from 'bun:test';
import { db, product } from '@echoppe/core';
import {
  createAdminSession,
  ensureCategory,
  ensureTaxRate,
  getJson,
  migrate,
  req,
  requireSmokeDb,
} from './harness';

// Verrou B8 (produits liés) : relation DIRECTIONNELLE curée (set ordonné via PATCH produit),
// exposée triée sur /products/:id/related ; auto-référence exclue ; fallback voisinage (même
// catégorie) quand aucune curation. Catégorie dédiée pour isoler le voisinage.
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

interface Card {
  slug: string;
}

let adminCookie: string;
const id: Record<string, string> = {};

async function makeProduct(slug: string, categoryId: string, taxRateId: string) {
  const [p] = await db
    .insert(product)
    .values({ category: categoryId, taxRate: taxRateId, name: slug, slug, status: 'published' })
    .returning();
  return p.id;
}

beforeAll(async () => {
  await migrate();
  const categoryId = await ensureCategory('rel-cat', 'Rel');
  const taxRateId = await ensureTaxRate();
  adminCookie = await createAdminSession();
  for (const slug of ['rel-a', 'rel-b', 'rel-c', 'rel-d']) {
    id[slug] = await makeProduct(slug, categoryId, taxRateId);
  }
});

const setRelated = (productId: string, relatedProductIds: string[]) =>
  req('PATCH', `/products/${productId}`, { cookie: adminCookie, body: { relatedProductIds } });

describe('B8 — produits liés', () => {
  it('curation : /related respecte l’ordre choisi', async () => {
    expect((await setRelated(id['rel-a'], [id['rel-c'], id['rel-b']])).status).toBe(200);
    const related = await getJson<Card[]>(`/products/${id['rel-a']}/related`);
    expect(related.map((c) => c.slug)).toEqual(['rel-c', 'rel-b']);
  });

  it('auto-référence exclue du set', async () => {
    await setRelated(id['rel-a'], [id['rel-a'], id['rel-b']]);
    const related = await getJson<Card[]>(`/products/${id['rel-a']}/related`);
    expect(related.map((c) => c.slug)).toEqual(['rel-b']);
  });

  it('fallback voisinage quand aucune curation (même catégorie, hors self)', async () => {
    const related = await getJson<Card[]>(`/products/${id['rel-d']}/related`);
    const slugs = related.map((c) => c.slug);
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs).not.toContain('rel-d');
    expect(slugs).toContain('rel-a');
  });
});
