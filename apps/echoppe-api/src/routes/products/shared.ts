import type { SQL } from '@echoppe/core';
import { and, asc, count, db, desc, eq, ilike, inArray, or, product } from '@echoppe/core';
import { t } from 'elysia';
import { selectDefaultVariants } from '../../utils/default-variant';
import {
  buildEqFilters,
  buildListResponse,
  getPaginationParams,
  paginationQuery,
} from '../../utils/pagination';
import { enrichProductCards } from '../../utils/product-cards';

// Éléments partagés par les sous-routes produits (public ↔ admin) : params, schémas de recherche et
// la projection « cartes produit » unique. `buildEqFilters` réexporté pour la liste admin.
export { buildEqFilters };

export const productParams = t.Object({
  id: t.String({ format: 'uuid' }),
});

// Query schema pour recherche/filtres/tri (liste publique).
export const productSearchQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
  search: t.Optional(t.String()),
  category: t.Optional(t.String({ format: 'uuid' })),
  minPrice: t.Optional(t.Numeric({ minimum: 0 })),
  maxPrice: t.Optional(t.Numeric({ minimum: 0 })),
  inStock: t.Optional(t.BooleanString()),
  sort: t.Optional(t.Union([t.Literal('price'), t.Literal('name'), t.Literal('dateCreated')])),
  order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
});

// Query admin = query publique + filtre `status` (l'admin voit/filtre tous les statuts).
export const productAdminSearchQuery = t.Composite([
  productSearchQuery,
  t.Object({ status: t.Optional(t.String()) }),
]);

// Query des sous-listes produit (catégorie/collection) : pagination + tri, même vocabulaire de tri
// que la liste globale. L'appartenance est portée par la route (extraConditions), pas par la query ;
// recherche/prix/stock ne sont pas exposés ici (hors scope de la sous-liste).
export const productSubListQuery = t.Composite([
  paginationQuery,
  t.Object({
    sort: t.Optional(t.Union([t.Literal('price'), t.Literal('name'), t.Literal('dateCreated')])),
    order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
  }),
]);

interface ProductCardsQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: string;
  order?: string;
}

// Liste de cartes produit enrichies, partagée public/admin. Mêmes recherche/filtres
// prix-stock/tri/pagination ; seule la VISIBILITÉ par statut diffère et est injectée
// par l'appelant via `statusConditions` (public = published forcé ; admin = filtre libre).
export async function queryProductCards(
  query: ProductCardsQuery,
  statusConditions: SQL[],
  extraConditions: SQL[] = [],
) {
  const { page, limit, offset } = getPaginationParams(query);
  const { search, category, minPrice, maxPrice, inStock, sort, order } = query;

  const conditions: SQL[] = [...statusConditions, ...extraConditions];

  if (search) {
    const searchPattern = `%${search}%`;
    const searchCondition = or(
      ilike(product.name, searchPattern),
      ilike(product.description, searchPattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  if (category) {
    conditions.push(eq(product.category, category));
  }

  // Filtres prix/stock : passent par la variante par défaut effective (isDefault, sinon 1re
  // publiée) — même résolution que les cartes, sinon un produit sans isDefault serait exclu.
  if (minPrice !== undefined || maxPrice !== undefined || inStock) {
    const defaultVariants = await selectDefaultVariants();
    const filteredProductIds = defaultVariants
      .filter((v) => {
        const price = parseFloat(v.priceHt);
        if (minPrice !== undefined && price < minPrice) return false;
        if (maxPrice !== undefined && price > maxPrice) return false;
        if (inStock && v.quantity <= 0) return false;
        return true;
      })
      .map((v) => v.product);

    if (filteredProductIds.length === 0) {
      return buildListResponse([], 0, page, limit);
    }
    conditions.push(inArray(product.id, filteredProductIds));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const sortOrder = order === 'desc' ? desc : asc;
  let orderByClause: SQL;
  switch (sort) {
    case 'name':
      orderByClause = sortOrder(product.name);
      break;
    case 'dateCreated':
      orderByClause = sortOrder(product.dateCreated);
      break;
    // 'price' : tri réel post-enrichissement (sur le variant par défaut).
    default:
      orderByClause = desc(product.dateCreated);
  }

  const [products, [{ total }]] = await Promise.all([
    db.select().from(product).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset),
    db
      .select({ total: count(product.id) })
      .from(product)
      .where(whereClause),
  ]);

  let enrichedProducts = await enrichProductCards(products);

  if (sort === 'price') {
    enrichedProducts = enrichedProducts.sort((a, b) => {
      const priceA = a.defaultVariant ? parseFloat(a.defaultVariant.priceHt) : 0;
      const priceB = b.defaultVariant ? parseFloat(b.defaultVariant.priceHt) : 0;
      return order === 'desc' ? priceB - priceA : priceA - priceB;
    });
  }

  return buildListResponse(enrichedProducts, total, page, limit);
}
