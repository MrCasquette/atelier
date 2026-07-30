import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { db, eq, inArray, media, product, productMedia, variant } from '@echoppe/core';
import {
  createAdminSession,
  ensureCategory,
  ensureTaxRate,
  getJson,
  migrate,
  req,
  requireSmokeDb,
} from './harness';

// Verrouille deux comportements storefront (brief DPC A3 + B1), régressions vécues côté boutique :
//  - A3 : la carte produit doit toujours porter un `defaultVariant` s'il existe ≥1 variante
//    PUBLIÉE, même sans `isDefault` (sinon faux out-of-stock). Fallback = 1re publiée par sortOrder.
//  - B1 : le détail produit expose `variants[].featuredImage`, sourcé du média featuredForVariant.
//
// ⚠️ Même contrat d'exécution que storefront-smoke : base JETABLE via `bun run test:smoke` only.
requireSmokeDb();

// FK partagées (category + taxRate) — la base vierge migrée n'a ni catégorie ni taux.
let categoryId: string;
let taxRateId: string;

// Session admin injectée en base (pas d'endpoint /auth/login → pas de dépendance Redis rate-limit).
// User owner → bypass RBAC (checkPermission : owner passe toute permission), aucune ligne permission.
let adminCookie: string;

// Ressources créées par test, nettoyées en ordre FK-safe (variant → product → media).
const createdProductIds: string[] = [];
const createdMediaIds: string[] = [];

interface VariantSeed {
  sku: string;
  priceHt: string;
  sortOrder: number;
  status?: 'draft' | 'published' | 'archived';
  isDefault?: boolean;
}

async function insertProduct(slug: string, variants: VariantSeed[]) {
  const [p] = await db
    .insert(product)
    .values({ category: categoryId, taxRate: taxRateId, name: slug, slug, status: 'published' })
    .returning();
  createdProductIds.push(p.id);

  const rows = await db
    .insert(variant)
    .values(
      variants.map((v) => ({
        product: p.id,
        sku: v.sku,
        priceHt: v.priceHt,
        sortOrder: v.sortOrder,
        status: v.status ?? 'published',
        isDefault: v.isDefault ?? false,
      })),
    )
    .returning();

  return { product: p, variants: rows };
}

async function insertMediaForVariant(productId: string, variantId: string) {
  const [m] = await db
    .insert(media)
    .values({
      filenameDisk: `${variantId}.jpg`,
      filenameOriginal: 'img.jpg',
      mimeType: 'image/jpeg',
      size: 1,
    })
    .returning();
  createdMediaIds.push(m.id);
  await db
    .insert(productMedia)
    .values({ product: productId, media: m.id, featuredForVariant: variantId });
  return m.id;
}

interface Card {
  slug: string;
  defaultVariant: {
    id: string;
    priceHt: string;
    compareAtPriceHt: string | null;
    quantity: number;
  } | null;
}

const cardFor = async (slug: string): Promise<Card> => {
  const body = await getJson<{ data: Card[] }>('/products/?limit=100');
  const card = body.data.find((p) => p.slug === slug);
  if (!card) throw new Error(`carte introuvable pour le slug ${slug}`);
  return card;
};

beforeAll(async () => {
  await migrate();
  categoryId = await ensureCategory();
  taxRateId = await ensureTaxRate();
  adminCookie = await createAdminSession();
});

afterEach(async () => {
  if (createdProductIds.length > 0) {
    // Ordre FK-safe : product_media (réfère variant via featuredForVariant, sans cascade) → variant
    // (réfère product, sans cascade) → product → media.
    await db.delete(productMedia).where(inArray(productMedia.product, createdProductIds));
    await db.delete(variant).where(inArray(variant.product, createdProductIds));
    await db.delete(product).where(inArray(product.id, createdProductIds));
    createdProductIds.length = 0;
  }
  if (createdMediaIds.length > 0) {
    await db.delete(media).where(inArray(media.id, createdMediaIds));
    createdMediaIds.length = 0;
  }
});

describe('A3 — defaultVariant retombe sur la 1re variante publiée', () => {
  it('aucune isDefault → 1re publiée par sortOrder', async () => {
    await insertProduct('a3-fallback', [
      { sku: 'A3-0', priceHt: '35.00', sortOrder: 0 },
      { sku: 'A3-1', priceHt: '32.00', sortOrder: 1 },
      { sku: 'A3-2', priceHt: '38.00', sortOrder: 2 },
    ]);
    const card = await cardFor('a3-fallback');
    expect(card.defaultVariant).not.toBeNull();
    expect(card.defaultVariant.priceHt).toBe('35.00');
  });

  it('isDefault prime sur sortOrder', async () => {
    await insertProduct('a3-isdefault', [
      { sku: 'AD-0', priceHt: '35.00', sortOrder: 0 },
      { sku: 'AD-2', priceHt: '38.00', sortOrder: 2, isDefault: true },
    ]);
    const card = await cardFor('a3-isdefault');
    expect(card.defaultVariant.priceHt).toBe('38.00');
  });

  it('1re variante en draft → saute à la publiée suivante', async () => {
    await insertProduct('a3-draft-skip', [
      { sku: 'AS-0', priceHt: '35.00', sortOrder: 0, status: 'draft' },
      { sku: 'AS-1', priceHt: '32.00', sortOrder: 1, status: 'published' },
    ]);
    const card = await cardFor('a3-draft-skip');
    expect(card.defaultVariant.priceHt).toBe('32.00');
  });

  it('aucune variante publiée → defaultVariant null (pas de fuite draft)', async () => {
    await insertProduct('a3-all-draft', [
      { sku: 'ALL-0', priceHt: '35.00', sortOrder: 0, status: 'draft' },
      { sku: 'ALL-1', priceHt: '32.00', sortOrder: 1, status: 'draft' },
    ]);
    const card = await cardFor('a3-all-draft');
    expect(card.defaultVariant).toBeNull();
  });
});

describe('B1 — variant.featuredImage sur le détail', () => {
  it('chaque variante porte son image featuredForVariant, null sinon', async () => {
    const { product: p, variants } = await insertProduct('b1-featured', [
      { sku: 'B1-0', priceHt: '35.00', sortOrder: 0, isDefault: true },
      { sku: 'B1-1', priceHt: '32.00', sortOrder: 1 },
    ]);
    const mediaId = await insertMediaForVariant(p.id, variants[0].id);

    const detail = await getJson<{
      variants: { id: string; featuredImage: { id: string } | null }[];
    }>('/products/by-slug/b1-featured');
    const byId = new Map(detail.variants.map((v) => [v.id, v]));
    // B5 : featuredImage est une ref {id,width,height} (dimensions nulles ici, média sans w/h).
    expect(byId.get(variants[0].id)?.featuredImage?.id).toBe(mediaId);
    expect(byId.get(variants[1].id)?.featuredImage).toBeNull();
  });
});

describe('A2 — exclusivité isDefault côté API (transaction)', () => {
  it('PUT isDefault=true décoche les autres variantes du produit', async () => {
    const { product: p, variants } = await insertProduct('a2-exclusive', [
      { sku: 'EX-0', priceHt: '35.00', sortOrder: 0, isDefault: true },
      { sku: 'EX-1', priceHt: '32.00', sortOrder: 1, isDefault: false },
    ]);

    const res = await req('PUT', `/products/${p.id}/variants/${variants[1].id}`, {
      cookie: adminCookie,
      body: { priceHt: 32, isDefault: true, status: 'published', sortOrder: 1, quantity: 8 },
    });
    expect(res.status).toBe(200);

    const rows = await db
      .select({ id: variant.id, isDefault: variant.isDefault })
      .from(variant)
      .where(eq(variant.product, p.id));
    const defaults = rows.filter((r) => r.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(variants[1].id);
  });
});
