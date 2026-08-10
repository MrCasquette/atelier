import { db, ilike, inArray } from '@repo/db';
import type { ReferenceTarget } from '@repo/references';
import { page } from './schema';

// La page comme cible référençable (ADR-0032). Elle vit ici parce que la TABLE vit ici : le
// descripteur interroge `page`, il appartient au paquet qui la livre.
//
// C'est une FONCTION, pas une inscription. Un paquet ne s'inscrit jamais tout seul — il n'a pas
// d'effet de bord à l'import, et c'est le produit qui décide de ce que son registre contient. Les
// deux produits appellent `pageReferenceTarget()` ; aucun ne réécrit les requêtes.

export type PageReferenceOptions = {
  /**
   * Où le front sert ses pages. Le schéma d'URL appartient au produit, pas au paquet — d'où le
   * réglage. `/:slug` est la convention livrée.
   */
  route?: string;
  label?: string;
};

export function pageReferenceTarget(options: PageReferenceOptions = {}): ReferenceTarget {
  return {
    name: 'page',
    label: options.label ?? 'Page',
    link: { mode: 'route', route: options.route ?? '/:slug' },
    // Déclaré ici pour la même raison que le reste du descripteur : la table vit dans ce paquet.
    // Un champ `ref('page')` d'entité peut donc porter une vraie clé étrangère (ADR-0045).
    storage: { table: 'page' },

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
  };
}
