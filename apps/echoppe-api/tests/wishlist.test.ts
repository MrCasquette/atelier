import { beforeAll, describe, expect, it } from 'bun:test';
import { db, product, variant } from '@echoppe/core';
import {
  createCustomerSession,
  ensureCategory,
  ensureTaxRate,
  migrate,
  req,
  requireSmokeDb,
} from './harness';

// Verrou B7 (wishlist) : surface client authentifiée sur des VARIANTES. Ajout idempotent, listing
// enrichi, retrait, et garde d'auth (401 anonyme). La table existait déjà (nettoyage suppression
// client) mais sans route. ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

interface WishlistItem {
  variant: { id: string; priceHt: string; quantity: number };
  product: { id: string; name: string; slug: string };
  featuredImage: { id: string } | null;
}

let cookie: string;
let variantId: string;

beforeAll(async () => {
  await migrate();
  const categoryId = await ensureCategory('wish-cat', 'Wish');
  const taxRateId = await ensureTaxRate();
  ({ cookie } = await createCustomerSession());

  const [p] = await db
    .insert(product)
    .values({
      category: categoryId,
      taxRate: taxRateId,
      name: 'wish',
      slug: 'wish-prod',
      status: 'published',
    })
    .returning();
  const [v] = await db
    .insert(variant)
    .values({
      product: p.id,
      sku: 'WISH-V',
      priceHt: '19.90',
      status: 'published',
      isDefault: true,
    })
    .returning();
  variantId = v.id;
});

describe('B7 — wishlist', () => {
  it('anonyme → 401 sur GET', async () => {
    expect((await req('GET', '/wishlist')).status).toBe(401);
  });

  it('POST épingle la variante, GET la liste enrichie', async () => {
    expect((await req('POST', '/wishlist', { cookie, body: { variantId } })).status).toBe(200);

    const list = (await (await req('GET', '/wishlist', { cookie })).json()) as WishlistItem[];
    expect(list).toHaveLength(1);
    expect(list[0].variant.id).toBe(variantId);
    expect(list[0].variant.priceHt).toBe('19.90');
    expect(list[0].product.slug).toBe('wish-prod');
  });

  it('POST est idempotent (PK customer+variant) → pas de doublon', async () => {
    await req('POST', '/wishlist', { cookie, body: { variantId } });
    const list = (await (await req('GET', '/wishlist', { cookie })).json()) as WishlistItem[];
    expect(list).toHaveLength(1);
  });

  it('POST variante inexistante → 404', async () => {
    const res = await req('POST', '/wishlist', {
      cookie,
      body: { variantId: '00000000-0000-4000-8000-000000000000' },
    });
    expect(res.status).toBe(404);
  });

  it('DELETE retire la variante', async () => {
    expect((await req('DELETE', `/wishlist/${variantId}`, { cookie })).status).toBe(200);
    const list = (await (await req('GET', '/wishlist', { cookie })).json()) as WishlistItem[];
    expect(list).toHaveLength(0);
  });
});
