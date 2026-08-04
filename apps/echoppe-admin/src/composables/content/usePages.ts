// Liste des pages du page builder (CRUD léger : lister, créer, supprimer). L'édition du contenu
// d'une page (métadonnées + zone dynamique) vit dans usePageEditor.
import { ref } from 'vue';
import { api } from '@/lib/api';
import type { PageDetail, PageListItem } from './types';

export function usePages() {
  const pages = ref<PageListItem[]>([]);
  const loading = ref(true);
  const saving = ref(false);

  async function load() {
    loading.value = true;
    const { data } = await api.content.pages.get();
    if (data) pages.value = data;
    loading.value = false;
  }

  async function createPage(input: { slug: string; title: string }): Promise<PageDetail | null> {
    saving.value = true;
    const { data, error } = await api.content.pages.post(input);
    saving.value = false;
    if (!error && data) {
      await load();
      return data;
    }
    return null;
  }

  async function deletePage(id: string): Promise<boolean> {
    const { error } = await api.content.pages({ id }).delete();
    if (!error) {
      await load();
      return true;
    }
    return false;
  }

  return { pages, loading, saving, load, createPage, deletePage };
}
