// Construction du payload de mutation d'une variante (POST/POST édition).
//
// ⚠️ La route API PUT/POST variante est un REMPLACEMENT COMPLET : omettre `isDefault`/`sortOrder`
// les réinitialise côté serveur (`isDefault → false`, `sortOrder → 0`). C'est la régression A1 (voir
// docs-internal/adr/ADR-0009). D'où la propagation SYSTÉMATIQUE de `isDefault`, et de `sortOrder`
// (préservé depuis la variante éditée) en mode édition.

export interface VariantFormValues {
  status: 'draft' | 'published' | 'archived';
  quantity: number;
  costPrice: string;
  priceHt: string;
  compareAtPriceHt: string;
  sku: string;
  barcode: string;
  length: string;
  width: string;
  height: string;
  weight: string;
  isDefault: boolean;
}

const num = (v: string): number | undefined => (v ? parseFloat(v) : undefined);
const str = (v: string): string | undefined => v || undefined;

// `editSortOrder` fourni (mode édition) → `sortOrder` inclus et préservé ; absent (création) → omis
// (l'API applique son défaut).
export function buildVariantPayload(form: VariantFormValues, editSortOrder?: number) {
  const payload = {
    status: form.status,
    quantity: form.quantity,
    priceHt: parseFloat(form.priceHt) || 0,
    costPrice: num(form.costPrice),
    compareAtPriceHt: num(form.compareAtPriceHt),
    sku: str(form.sku),
    barcode: str(form.barcode),
    length: num(form.length),
    width: num(form.width),
    height: num(form.height),
    weight: num(form.weight),
    isDefault: form.isDefault,
  };
  return editSortOrder === undefined ? payload : { ...payload, sortOrder: editSortOrder };
}
