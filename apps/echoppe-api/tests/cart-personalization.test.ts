import { beforeAll, describe, expect, it } from 'bun:test';
import { db, personalizationField, product, variant } from '@echoppe/core';
import { calculateOrderTotals } from '../src/services/checkout';
import {
  createAdminSession,
  ensureCategory,
  ensureTaxRate,
  getJson,
  migrate,
  req,
  requireSmokeDb,
} from './harness';

// Verrou B2 (personnalisation produit, ADR-0010) : le détail expose les champs déclarés ; l'ajout
// panier valide + calcule le supplément côté back (jamais le front) ; la commande le snapshote.
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

let categoryId: string;
let taxRateId: string;
let adminCookie: string; // session admin owner injectée (bypass RBAC), cf. harness.createAdminSession

// Produit personnalisable : 1 variante publiée à 35 € + 1 champ « Prénom » requis +5 €.
async function personalizableProduct(slug: string) {
  const [p] = await db
    .insert(product)
    .values({
      category: categoryId,
      taxRate: taxRateId,
      name: slug,
      slug,
      status: 'published',
      personalizationEnabled: true,
    })
    .returning();
  const [v] = await db
    .insert(variant)
    .values({
      product: p.id,
      sku: `${slug}-V`,
      priceHt: '35.00',
      status: 'published',
      isDefault: true,
      quantity: 10,
    })
    .returning();
  const [field] = await db
    .insert(personalizationField)
    .values({
      product: p.id,
      label: 'Prénom',
      type: 'text',
      required: true,
      maxLength: 20,
      priceHt: '5.00',
    })
    .returning();
  return { product: p, variant: v, field };
}

beforeAll(async () => {
  await migrate();
  categoryId = await ensureCategory();
  taxRateId = await ensureTaxRate();
  adminCookie = await createAdminSession();
});

const postCart = (body: unknown) => req('POST', '/cart/items', { body });

describe('B2 — personnalisation produit', () => {
  it('le détail by-slug expose personalizationEnabled + les champs', async () => {
    const { field } = await personalizableProduct('perso-detail');
    const detail = await getJson<{
      personalizationEnabled: boolean;
      personalizationFields: { id: string; label: string; priceHt: string; required: boolean }[];
    }>('/products/by-slug/perso-detail');
    expect(detail.personalizationEnabled).toBe(true);
    expect(detail.personalizationFields).toHaveLength(1);
    expect(detail.personalizationFields[0]).toMatchObject({
      id: field.id,
      label: 'Prénom',
      priceHt: '5.00',
      required: true,
    });
  });

  it('ajout panier : écho des valeurs + supplément +5 € dans le total', async () => {
    const { variant: v, field } = await personalizableProduct('perso-cart');
    const res = await postCart({
      variantId: v.id,
      quantity: 1,
      personalization: { [field.id]: 'Lucie' },
    });
    expect(res.status).toBe(200);
    const cart = (await res.json()) as {
      totalHt: string;
      items: { addonPriceHt: string; personalization: { label: string; value: string }[] }[];
    };
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].addonPriceHt).toBe('5.00');
    expect(cart.items[0].personalization).toEqual([
      { fieldId: field.id, label: 'Prénom', value: 'Lucie' },
    ]);
    expect(cart.totalHt).toBe('40.00'); // (35 + 5) × 1
  });

  it('validation : champ requis manquant → 400', async () => {
    const { variant: v } = await personalizableProduct('perso-required');
    const res = await postCart({ variantId: v.id, quantity: 1, personalization: {} });
    expect(res.status).toBe(400);
  });

  it('validation : champ inconnu → 400', async () => {
    const { variant: v } = await personalizableProduct('perso-unknown');
    const res = await postCart({
      variantId: v.id,
      quantity: 1,
      personalization: { 'not-a-field': 'x' },
    });
    expect(res.status).toBe(400);
  });

  it('commande : le supplément entre dans les totaux (snapshot)', async () => {
    const { product: p, variant: v, field } = await personalizableProduct('perso-order');
    const totals = await calculateOrderTotals([
      {
        id: 'line-1',
        quantity: 2,
        personalization: { [field.id]: 'Lucie' },
        variant: { id: v.id, priceHt: '35.00', sku: v.sku, quantity: 10 },
        product: { id: p.id, name: p.name, taxRateId },
      },
    ]);
    expect(totals.items[0].addonPriceHt).toBe(5);
    expect(totals.items[0].totalHt).toBe(80); // (35 + 5) × 2
  });

  it('CRUD admin : création d’un champ → exposé au storefront → suppression', async () => {
    const [p] = await db
      .insert(product)
      .values({
        category: categoryId,
        taxRate: taxRateId,
        name: 'perso-crud',
        slug: 'perso-crud',
        status: 'published',
        personalizationEnabled: true,
      })
      .returning();

    const base = `/products/${p.id}/personalization-fields`;
    const createRes = await req('POST', base, {
      cookie: adminCookie,
      body: { label: 'Gravure', type: 'text', maxLength: 15, priceHt: 3 },
    });
    expect(createRes.status).toBe(200);
    const created = (await createRes.json()) as { id: string; priceHt: string };
    expect(created.priceHt).toBe('3.00');

    const detail = await getJson<{ personalizationFields: { id: string }[] }>(
      '/products/by-slug/perso-crud',
    );
    expect(detail.personalizationFields.map((f) => f.id)).toContain(created.id);

    const delRes = await req('DELETE', `${base}/${created.id}`, { cookie: adminCookie });
    expect(delRes.status).toBe(200);
    const after = await getJson<{ personalizationFields: unknown[] }>(
      '/products/by-slug/perso-crud',
    );
    expect(after.personalizationFields).toHaveLength(0);
  });
});
