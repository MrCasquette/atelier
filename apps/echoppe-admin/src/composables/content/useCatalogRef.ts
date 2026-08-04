// Accès catalogue pour un champ de référence : recherche d'entités et résolution d'un libellé
// depuis un UUID. Normalise les surfaces API en `RefOption`. Cibles : produit/collection/catégorie
// (champ `ref` du registre P3) + page (liens de menu).
import { ref } from 'vue';
import { api } from '@/lib/api';
import type { RefTarget } from './types';

// Cible élargie : les refs du registre (RefTarget) + `page` pour les liens de menu.
export type CatalogTarget = RefTarget | 'page';

export interface RefOption {
  id: string;
  name: string;
}

const TARGET_LABELS: Record<CatalogTarget, string> = {
  product: 'produit',
  collection: 'collection',
  category: 'catégorie',
  page: 'page',
};

function filterByName(items: RefOption[], term: string): RefOption[] {
  if (!term) return items;
  const needle = term.toLowerCase();
  return items.filter((item) => item.name.toLowerCase().includes(needle));
}

export function useCatalogRef(target: CatalogTarget) {
  const options = ref<RefOption[]>([]);
  const loading = ref(false);

  async function search(term: string) {
    loading.value = true;
    if (target === 'product') {
      // Recherche serveur (catalogue potentiellement volumineux).
      const { data } = await api.products.get({ query: { search: term || undefined, limit: 20 } });
      options.value = data && 'data' in data ? data.data.map((p) => ({ id: p.id, name: p.name })) : [];
    } else if (target === 'collection') {
      const { data } = await api.collections.get({ query: { limit: 100 } });
      const items = data && 'data' in data ? data.data.map((c) => ({ id: c.id, name: c.name })) : [];
      options.value = filterByName(items, term);
    } else if (target === 'category') {
      const { data } = await api.categories.get();
      const items = data ? data.map((c) => ({ id: c.id, name: c.name })) : [];
      options.value = filterByName(items, term);
    } else {
      const { data } = await api.content.pages.get();
      const items = data ? data.map((p) => ({ id: p.id, name: p.title })) : [];
      options.value = filterByName(items, term);
    }
    loading.value = false;
  }

  // Libellé d'une référence déjà sélectionnée (affichage du chip).
  async function resolveLabel(id: string): Promise<string | null> {
    if (target === 'product') {
      const { data } = await api.products({ id }).get();
      return data && 'name' in data ? data.name : null;
    }
    if (target === 'collection') {
      const { data } = await api.collections({ id }).get();
      return data && 'name' in data ? data.name : null;
    }
    if (target === 'category') {
      const { data } = await api.categories({ id }).get();
      return data && 'name' in data ? data.name : null;
    }
    const { data } = await api.content.pages({ id }).get();
    return data && 'title' in data ? data.title : null;
  }

  return { options, loading, search, resolveLabel, targetLabel: TARGET_LABELS[target] };
}
