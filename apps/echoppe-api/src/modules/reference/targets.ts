import { category, collection, product } from '@echoppe/core';
import { db, getTableName, ilike, inArray } from '@repo/db';
import { pageReferenceTarget } from '@repo/pages';
import { createReferenceRegistry, type EntityProjection } from '@repo/references';

// Le registre de cibles référençables d'ÉCHOPPE (ADR-0032) : le socle sait qu'il existe des cibles,
// c'est ici qu'on dit lesquelles. Prisme aura son pendant, et n'inscrira pas `product`.
//
// Deux natures d'inscription, et la frontière entre elles est la même que partout :
//   - `page` est GÉNÉRIQUE — son descripteur est livré par `@repo/pages`, le paquet qui livre la
//     table. On l'inscrit, on ne le réécrit pas. Un paquet ne s'inscrit jamais tout seul : le
//     produit décide de ce que son registre contient.
//   - le reste est propre à Échoppe, et déclaré ici. C'est le seul endroit du dépôt où le
//     vocabulaire COMMERCE rencontre le mécanisme de lien.
//
// Les routes déclarées sont celles du storefront livré (`/produits/:slug`). **La déclaration fait
// foi** : si le dev remplace le rendu par ses propres pages, rien ne garantit techniquement
// qu'elles restent vraies. Un lien cassé est un 404, pas une corruption (ADR-0032).
//
// `storage` est l'autre moitié : la route dit où lire la cible côté front, la table dit où elle vit
// en base — de quoi permettre à un champ `ref` qui la vise de porter une vraie clé étrangère
// (ADR-0045). Le nom est LU sur la table Drizzle, jamais recopié : le schéma reste la seule source,
// et un renommage ne peut pas laisser un littéral périmé derrière lui. Une cible dont le stockage
// ne se nomme pas si simplement se tait, et son champ garde un `uuid` nu.

const SEARCH_LIMIT_MAX = 100;

export const references = createReferenceRegistry();

references.register(pageReferenceTarget());

references.register({
  name: 'product',
  label: 'Produit',
  link: { mode: 'route', route: '/produits/:slug' },
  storage: { table: getTableName(product) },
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
  storage: { table: getTableName(collection) },
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
  storage: { table: getTableName(category) },
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
