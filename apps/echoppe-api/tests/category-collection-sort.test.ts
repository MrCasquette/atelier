import { beforeAll, describe, expect, it } from 'bun:test';
import { collection, product, productCollection, variant } from '@echoppe/core';
import { db } from '@repo/db';
import {
  ensureCategory,
  ensureTaxRate,
  getJson,
  migrate,
  record,
  records,
  requireDisposableDb,
} from './harness';

// Verrou B4 (tri des sous-listes produit) : `/categories/:id/products` et `/collections/:id/products`
// délèguent à queryProductCards → honorent `?sort=price&order=…` (comme la liste globale) au lieu du
// tri dateCreated figé. Catégorie/collection DÉDIÉES pour isoler le jeu de produits du tri.
// ⚠️ Base JETABLE via `bun run test:api` uniquement.
requireDisposableDb();

let categoryId: string;
let taxRateId: string;
const priceOfSlug = new Map<string, number>();

// Produit publié à prix connu (variante par défaut unique) dans la catégorie de tri.
async function pricedProduct(slug: string, priceHt: number) {
  const [p] = await db
    .insert(product)
    .values({ category: categoryId, taxRate: taxRateId, name: slug, slug, status: 'published' })
    .returning();
  await db.insert(variant).values({
    product: p.id,
    sku: `${slug}-V`,
    priceHt: priceHt.toFixed(2),
    status: 'published',
    isDefault: true,
    quantity: 5,
  });
  priceOfSlug.set(slug, priceHt);
  return p.id;
}

beforeAll(async () => {
  await migrate();
  categoryId = await ensureCategory('sort-cat', 'Sort');
  taxRateId = await ensureTaxRate();
});

describe('B4 — tri des produits par catégorie', () => {
  it('?sort=price&order=asc puis desc → ordonne sur le prix de la variante par défaut', async () => {
    await pricedProduct('sort-c-30', 30);
    await pricedProduct('sort-c-10', 10);
    await pricedProduct('sort-c-20', 20);

    const asc = record(await getJson(
      `/categories/${categoryId}/products?sort=price&order=asc`,
    ));
    expect(records(asc.data, 'data').map((c) => c.slug)).toEqual(['sort-c-10', 'sort-c-20', 'sort-c-30']);

    const desc = record(await getJson(
      `/categories/${categoryId}/products?sort=price&order=desc`,
    ));
    expect(records(desc.data, 'data').map((c) => c.slug)).toEqual(['sort-c-30', 'sort-c-20', 'sort-c-10']);
  });
});

describe('B4 — tri des produits par collection', () => {
  it('?sort=price&order=desc → même délégation à queryProductCards', async () => {
    const ids = await Promise.all([
      pricedProduct('sort-col-15', 15),
      pricedProduct('sort-col-45', 45),
      pricedProduct('sort-col-25', 25),
    ]);
    const [col] = await db
      .insert(collection)
      .values({ name: 'Tri', slug: 'sort-collection', isVisible: true })
      .returning();
    await db
      .insert(productCollection)
      .values(ids.map((product) => ({ collection: col.id, product })));

    const desc = record(await getJson(
      `/collections/${col.id}/products?sort=price&order=desc`,
    ));
    expect(records(desc.data, 'data').map((c) => c.slug)).toEqual(['sort-col-45', 'sort-col-25', 'sort-col-15']);
  });
});
