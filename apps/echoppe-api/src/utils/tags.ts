import { db, eq, inArray, productTag, tag } from '@echoppe/core';
import { slugify } from '@echoppe/shared';

// Tags produit (B3). Surface storefront = `tags: string[]` (noms, triés). L'identité canonique
// d'un tag est son `slug` ; le `name` est le libellé affiché. Lecture batchée pour les cartes,
// écriture en set (le PUT produit remplace l'ensemble des tags du produit).

// Noms de tags par produit (batch) → alimente cartes + détail sans requête par produit.
export async function getTagsByProduct(productIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (productIds.length === 0) return map;

  const rows = await db
    .select({ product: productTag.product, name: tag.name })
    .from(productTag)
    .innerJoin(tag, eq(tag.id, productTag.tag))
    .where(inArray(productTag.product, productIds));

  for (const row of rows) {
    const list = map.get(row.product) ?? [];
    list.push(row.name);
    map.set(row.product, list);
  }
  // Tri locale-aware (FR) et déterministe — indépendant de la collation Postgres.
  for (const list of map.values()) list.sort((a, b) => a.localeCompare(b, 'fr'));
  return map;
}

export async function getProductTags(productId: string): Promise<string[]> {
  return (await getTagsByProduct([productId])).get(productId) ?? [];
}

// Remplace l'ensemble des tags d'un produit (sémantique set). Upsert des tags par slug (identité
// canonique — un même slug est réutilisé, son libellé est resynchronisé), puis réécrit la junction.
export async function setProductTags(productId: string, names: string[]): Promise<void> {
  // Dédup par slug (dernier libellé gagne) ; ignore les entrées vides / non-slugifiables.
  const bySlug = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const slug = slugify(name);
    if (!slug) continue;
    bySlug.set(slug, name);
  }

  await db.transaction(async (tx) => {
    const tagIds: string[] = [];
    for (const [slug, name] of bySlug) {
      const [row] = await tx
        .insert(tag)
        .values({ name, slug })
        .onConflictDoUpdate({ target: tag.slug, set: { name } })
        .returning({ id: tag.id });
      tagIds.push(row.id);
    }

    await tx.delete(productTag).where(eq(productTag.product, productId));
    if (tagIds.length > 0) {
      await tx.insert(productTag).values(tagIds.map((id) => ({ product: productId, tag: id })));
    }
  });
}
