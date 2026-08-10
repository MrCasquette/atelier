import { category, collection, db, ilike, inArray, page, product } from '@echoppe/core';
import { createReferenceRegistry, type EntityProjection } from '@repo/references';

// Les cibles référençables d'ÉCHOPPE (ADR-0032). Ce fichier est le seul endroit du dépôt où le
// vocabulaire commerce rencontre le mécanisme de lien — c'est exactement ce que l'ADR voulait :
// le socle sait qu'il existe des cibles, Échoppe dit lesquelles. Prisme aura son pendant, et
// n'inscrira pas `product`.
//
// Les routes déclarées sont celles du storefront livré (`/produits/:slug`). **La déclaration fait
// foi** : si le dev remplace le rendu par ses propres pages, rien ne garantit techniquement
// qu'elles restent vraies. Un lien cassé est un 404, pas une corruption (ADR-0032).

const SEARCH_LIMIT_MAX = 100;

export const references = createReferenceRegistry();

references.register({
  name: 'page',
  label: 'Page',
  link: { mode: 'route', route: '/:slug' },
  async project(ids) {
    return db
      .select({ id: page.id, slug: page.slug, name: page.title })
      .from(page)
      .where(inArray(page.id, ids));
  },
  async search(term, limit) {
    const rows = db.select({ id: page.id, slug: page.slug, name: page.title }).from(page);
    return term ? rows.where(ilike(page.title, `%${term}%`)).limit(limit) : rows.limit(limit);
  },
});

references.register({
  name: 'product',
  label: 'Produit',
  link: { mode: 'route', route: '/produits/:slug' },
  async project(ids) {
    return db
      .select({ id: product.id, slug: product.slug, name: product.name })
      .from(product)
      .where(inArray(product.id, ids));
  },
  async search(term, limit) {
    const rows = db
      .select({ id: product.id, slug: product.slug, name: product.name })
      .from(product);
    return term ? rows.where(ilike(product.name, `%${term}%`)).limit(limit) : rows.limit(limit);
  },
});

references.register({
  name: 'collection',
  label: 'Collection',
  link: { mode: 'route', route: '/collections/:slug' },
  async project(ids) {
    return db
      .select({ id: collection.id, slug: collection.slug, name: collection.name })
      .from(collection)
      .where(inArray(collection.id, ids));
  },
  async search(term, limit) {
    const rows = db
      .select({ id: collection.id, slug: collection.slug, name: collection.name })
      .from(collection);
    return term ? rows.where(ilike(collection.name, `%${term}%`)).limit(limit) : rows.limit(limit);
  },
});

references.register({
  name: 'category',
  label: 'Catégorie',
  link: { mode: 'route', route: '/categories/:slug' },
  async project(ids) {
    return db
      .select({ id: category.id, slug: category.slug, name: category.name })
      .from(category)
      .where(inArray(category.id, ids));
  },
  async search(term, limit) {
    const rows = db
      .select({ id: category.id, slug: category.slug, name: category.name })
      .from(category);
    return term ? rows.where(ilike(category.name, `%${term}%`)).limit(limit) : rows.limit(limit);
  },
});

export type ReferenceTargetSummary = {
  name: string;
  label: string;
  /** Route déclarée, ou `null` pour les modes qui ne produisent pas d'URL depuis la seule entité. */
  route: string | null;
};

export function listReferenceTargets(): ReferenceTargetSummary[] {
  return references.list().map((target) => ({
    name: target.name,
    label: target.label,
    route: target.link.mode === 'route' ? target.link.route : null,
  }));
}

export type ReferenceLookup =
  | { outcome: 'found'; entities: EntityProjection[] }
  | { outcome: 'unknown-target' };

/** Cherche des entités d'une cible par terme libre. Cible inconnue = issue typée, pas une exception. */
export async function searchTarget(
  name: string,
  term: string,
  limit: number,
): Promise<ReferenceLookup> {
  const target = references.get(name);
  if (!target) return { outcome: 'unknown-target' };

  return {
    outcome: 'found',
    entities: await target.search(term, Math.min(limit, SEARCH_LIMIT_MAX)),
  };
}

/** Projette des identifiants déjà stockés — sert au libellé d'une référence sélectionnée. */
export async function projectTarget(name: string, ids: string[]): Promise<ReferenceLookup> {
  const target = references.get(name);
  if (!target) return { outcome: 'unknown-target' };
  if (ids.length === 0) return { outcome: 'found', entities: [] };

  return { outcome: 'found', entities: await target.project(ids) };
}
