import { category, collection, db, inArray, page, product } from '@echoppe/core';
import type { EntityProjection, MenuItemInput, ResolvedMenuItem } from '../models/menu';

// Résolution des refs internes d'un menu au read storefront : chaque lien vers une entité
// (page/produit/collection/catégorie) est remplacé par sa projection { id, slug, name } (null si
// dangling). Les liens URL passent tels quels. Une requête groupée par table (menus = petit
// volume), puis reconstruction de l'arbre. Le front reste maître de l'URL finale (on renvoie
// slug/name, pas un chemin en dur → agnosticisme front).

type InternalTarget = 'page' | 'product' | 'collection' | 'category';

function collectIds(items: MenuItemInput[], acc: Record<InternalTarget, Set<string>>): void {
  for (const item of items) {
    if (item.link.target !== 'url') acc[item.link.target].add(item.link.value);
    collectIds(item.children, acc);
  }
}

export async function resolveMenuItems(items: MenuItemInput[]): Promise<ResolvedMenuItem[]> {
  const ids: Record<InternalTarget, Set<string>> = {
    page: new Set(),
    product: new Set(),
    collection: new Set(),
    category: new Set(),
  };
  collectIds(items, ids);

  const maps: Record<InternalTarget, Map<string, EntityProjection>> = {
    page: new Map(),
    product: new Map(),
    collection: new Map(),
    category: new Map(),
  };

  if (ids.page.size > 0) {
    const rows = await db
      .select({ id: page.id, slug: page.slug, name: page.title })
      .from(page)
      .where(inArray(page.id, [...ids.page]));
    for (const row of rows) maps.page.set(row.id, row);
  }
  if (ids.product.size > 0) {
    const rows = await db
      .select({ id: product.id, slug: product.slug, name: product.name })
      .from(product)
      .where(inArray(product.id, [...ids.product]));
    for (const row of rows) maps.product.set(row.id, row);
  }
  if (ids.collection.size > 0) {
    const rows = await db
      .select({ id: collection.id, slug: collection.slug, name: collection.name })
      .from(collection)
      .where(inArray(collection.id, [...ids.collection]));
    for (const row of rows) maps.collection.set(row.id, row);
  }
  if (ids.category.size > 0) {
    const rows = await db
      .select({ id: category.id, slug: category.slug, name: category.name })
      .from(category)
      .where(inArray(category.id, [...ids.category]));
    for (const row of rows) maps.category.set(row.id, row);
  }

  const resolve = (nodes: MenuItemInput[]): ResolvedMenuItem[] =>
    nodes.map((item): ResolvedMenuItem => {
      const { link } = item;
      return {
        label: item.label,
        link:
          link.target === 'url'
            ? { target: 'url', url: link.value, newTab: link.newTab }
            : {
                target: link.target,
                entity: maps[link.target].get(link.value) ?? null,
                newTab: link.newTab,
              },
        children: resolve(item.children),
      };
    });

  return resolve(items);
}
