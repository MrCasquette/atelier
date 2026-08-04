import {
  and,
  db,
  desc,
  eq,
  inArray,
  ne,
  or,
  product,
  productCollection,
  productRelated,
} from '@echoppe/core';

// Produits liés (B8) — relation directionnelle curée (ADR-0022). Lecture ordonnée + écriture set
// (le PUT produit remplace l'ensemble). Fallback voisinage (même catégorie / collection) calculé à
// la lecture quand la curation est vide.

// IDs des produits liés curés, dans l'ordre choisi par le commerçant.
export async function getRelatedProductIds(productId: string): Promise<string[]> {
  const rows = await db
    .select({ id: productRelated.relatedProduct })
    .from(productRelated)
    .where(eq(productRelated.product, productId))
    .orderBy(productRelated.sortOrder);
  return rows.map((r) => r.id);
}

// Remplace l'ensemble ordonné des produits liés (sémantique set). Exclut l'auto-référence et
// dédoublonne en préservant le premier ordre d'apparition.
export async function setRelatedProducts(productId: string, ids: string[]): Promise<void> {
  const ordered: string[] = [];
  const seen = new Set<string>([productId]); // exclut l'auto-référence
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  await db.transaction(async (tx) => {
    await tx.delete(productRelated).where(eq(productRelated.product, productId));
    if (ordered.length > 0) {
      await tx.insert(productRelated).values(
        ordered.map((relatedProduct, sortOrder) => ({
          product: productId,
          relatedProduct,
          sortOrder,
        })),
      );
    }
  });
}

// Fallback voisinage : produits PUBLIÉS de la même catégorie OU d'une collection commune, hors
// le produit lui-même, les plus récents d'abord. Utilisé seulement si aucune curation.
export async function getFallbackRelatedIds(
  productId: string,
  categoryId: string,
  limit: number,
): Promise<string[]> {
  const cols = await db
    .select({ collection: productCollection.collection })
    .from(productCollection)
    .where(eq(productCollection.product, productId));
  const collectionIds = cols.map((c) => c.collection);

  const sameCollectionProductIds =
    collectionIds.length > 0
      ? (
          await db
            .select({ product: productCollection.product })
            .from(productCollection)
            .where(inArray(productCollection.collection, collectionIds))
        ).map((r) => r.product)
      : [];

  const neighbourhood =
    sameCollectionProductIds.length > 0
      ? or(eq(product.category, categoryId), inArray(product.id, sameCollectionProductIds))
      : eq(product.category, categoryId);

  const rows = await db
    .select({ id: product.id })
    .from(product)
    .where(and(eq(product.status, 'published'), ne(product.id, productId), neighbourhood))
    .orderBy(desc(product.dateCreated))
    .limit(limit);
  return rows.map((r) => r.id);
}
