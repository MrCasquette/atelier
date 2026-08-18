import { variant } from '@echoppe/core';
import { and, asc, db, desc, eq, inArray } from '@repo/db';

// Variante effective par défaut d'un produit côté storefront : la variante isDefault=true si
// elle existe, sinon la 1re variante publiée (sortOrder croissant, id en départage). Ne considère
// QUE les variantes publiées — jamais un prix/stock de brouillon ou d'archive exposé à la boutique.
// Source unique partagée par l'enrichissement des cartes et les filtres/tri prix des listings :
// sans ce fallback, un produit dépourvu d'isDefault affiche prix/stock null (faux OOS).
export interface DefaultVariantRow {
  id: string;
  product: string;
  priceHt: string;
  compareAtPriceHt: string | null;
  quantity: number;
}

// `productIds` omis → tout le catalogue publié (filtres appliqués avant pagination).
export function selectDefaultVariants(productIds?: string[]): Promise<DefaultVariantRow[]> {
  if (productIds && productIds.length === 0) return Promise.resolve([]);

  const conditions = [eq(variant.status, 'published')];
  if (productIds) conditions.push(inArray(variant.product, productIds));

  return (
    db
      .selectDistinctOn([variant.product], {
        id: variant.id,
        product: variant.product,
        priceHt: variant.priceHt,
        compareAtPriceHt: variant.compareAtPriceHt,
        quantity: variant.quantity,
      })
      .from(variant)
      .where(and(...conditions))
      // DISTINCT ON garde la 1re ligne par produit : isDefault d'abord, puis sortOrder.
      .orderBy(variant.product, desc(variant.isDefault), asc(variant.sortOrder), variant.id)
  );
}
