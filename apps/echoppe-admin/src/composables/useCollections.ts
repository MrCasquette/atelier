import { ref } from 'vue';
import { api } from '@/lib/api';
import type { ApiData } from '@/types/api';

// Data layer des collections (aligné sur useCategories/usePages/useMenus) : la vue ne fait plus
// d'appel API inline, elle orchestre l'UI (modale, toast) et délègue ici. Les fonctions renvoient
// un booléen de succès ; la vue décide du feedback.
type CollectionsResponse = ApiData<ReturnType<typeof api.collections.get>>;
export type Collection = CollectionsResponse['data'][number];

export interface CollectionPayload {
  name: string;
  description?: string;
  image?: string;
  isVisible: boolean;
}

export function useCollections() {
  const collections = ref<Collection[]>([]);
  const loading = ref(true);
  const saving = ref(false);

  async function load() {
    loading.value = true;
    const { data } = await api.collections.get({ query: { limit: 100 } });
    if (data) collections.value = data.data;
    loading.value = false;
  }

  // Crée (id absent) ou met à jour (id fourni). `true` si OK, `false` sur erreur HTTP.
  async function saveCollection(payload: CollectionPayload, id?: string): Promise<boolean> {
    saving.value = true;
    const { error } = id
      ? await api.collections({ id }).put(payload)
      : await api.collections.post(payload);
    saving.value = false;
    if (error) return false;
    await load();
    return true;
  }

  async function deleteCollection(id: string): Promise<boolean> {
    const { error } = await api.collections({ id }).delete();
    if (error) return false;
    await load();
    return true;
  }

  return { collections, loading, saving, load, saveCollection, deleteCollection };
}
