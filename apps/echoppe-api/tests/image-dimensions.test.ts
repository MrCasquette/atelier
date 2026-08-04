import { beforeAll, describe, expect, it } from 'bun:test';
import { db, media, product, productMedia, variant } from '@echoppe/core';
import { ensureCategory, ensureTaxRate, getJson, migrate, requireSmokeDb } from './harness';

// Verrou B5 (dimensions image storefront) : le framework n'optimise PAS les images (pas de resize
// serveur) — il expose l'original + ses dimensions intrinsèques (px). featuredImage/images sont des
// refs {id,width,height} sur la carte ET le détail. Catégorie dédiée pour isoler le produit.
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

interface ImageRef {
  id: string;
  width: number | null;
  height: number | null;
}

let categoryId: string;
let taxRateId: string;

beforeAll(async () => {
  await migrate();
  categoryId = await ensureCategory('img-cat', 'Img');
  taxRateId = await ensureTaxRate();
});

describe('B5 — dimensions image (carte + détail)', () => {
  it('featuredImage porte {id,width,height} depuis le média', async () => {
    const [p] = await db
      .insert(product)
      .values({
        category: categoryId,
        taxRate: taxRateId,
        name: 'img',
        slug: 'img-dim',
        status: 'published',
      })
      .returning();
    await db.insert(variant).values({
      product: p.id,
      sku: 'IMG-V',
      priceHt: '10.00',
      status: 'published',
      isDefault: true,
    });
    const [m] = await db
      .insert(media)
      .values({
        filenameDisk: 'x.jpg',
        filenameOriginal: 'x.jpg',
        mimeType: 'image/jpeg',
        size: 1,
        width: 800,
        height: 600,
      })
      .returning();
    await db.insert(productMedia).values({ product: p.id, media: m.id, isFeatured: true });

    const list = await getJson<{ data: { slug: string; featuredImage: ImageRef | null }[] }>(
      '/products/?limit=100',
    );
    const card = list.data.find((c) => c.slug === 'img-dim');
    expect(card?.featuredImage).toEqual({ id: m.id, width: 800, height: 600 });

    const detail = await getJson<{ images: ImageRef[] }>('/products/by-slug/img-dim');
    expect(detail.images[0]).toEqual({ id: m.id, width: 800, height: 600 });
  });
});
