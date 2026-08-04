import { describe, expect, it } from 'bun:test';
import { buildVariantPayload, type VariantFormValues } from './variant-payload';

// Verrou de régression A1/A2 (cf. docs-internal/adr/ADR-0009) : le payload de mutation variante doit
// TOUJOURS porter isDefault, et préserver sortOrder en édition — sinon la route (remplacement complet)
// réinitialise ces champs à chaque enregistrement du VariantModal.

const form: VariantFormValues = {
  status: 'published',
  quantity: 12,
  costPrice: '',
  priceHt: '35.00',
  compareAtPriceHt: '',
  sku: 'SKU-1',
  barcode: '',
  length: '',
  width: '',
  height: '',
  weight: '',
  isDefault: true,
};

describe('buildVariantPayload', () => {
  it('édition : préserve sortOrder et propage isDefault', () => {
    const payload = buildVariantPayload(form, 3);
    expect(payload).toMatchObject({ isDefault: true, sortOrder: 3 });
  });

  it('création : pas de sortOrder, isDefault présent', () => {
    const payload = buildVariantPayload({ ...form, isDefault: false });
    expect('sortOrder' in payload).toBe(false);
    expect(payload.isDefault).toBe(false);
  });

  it('sortOrder=0 en édition reste transmis (0 ≠ absent)', () => {
    const payload = buildVariantPayload(form, 0);
    expect((payload as { sortOrder?: number }).sortOrder).toBe(0);
  });

  it('parse les numériques et omet les optionnels vides', () => {
    const payload = buildVariantPayload(form, 1);
    expect(payload.priceHt).toBe(35);
    expect(payload.sku).toBe('SKU-1');
    expect(payload.costPrice).toBeUndefined();
    expect(payload.barcode).toBeUndefined();
  });
});
