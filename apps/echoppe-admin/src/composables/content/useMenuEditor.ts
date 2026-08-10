// État d'édition d'un menu : libellé + arbre d'items récursif. La validation fine (shape récursif)
// est faite côté serveur (menuItemsSchema) → message d'erreur remonté tel quel.
import { ref } from 'vue';
import { api } from '@/lib/api';
import { errorMessage, type SaveResult } from '@/lib/apiError';
import type { MenuDetail, MenuItem } from './menuTypes';

export function useMenuEditor() {
  const menu = ref<MenuDetail | null>(null);
  const handle = ref('');
  const label = ref('');
  const items = ref<MenuItem[]>([]);
  const loading = ref(true);
  const saving = ref(false);

  async function load(id: string) {
    loading.value = true;
    const { data } = await api.content.menus({ id }).get();
    if (data) {
      menu.value = data;
      handle.value = data.handle;
      label.value = data.label;
      items.value = data.items;
    }
    loading.value = false;
  }

  async function save(id: string): Promise<SaveResult> {
    saving.value = true;
    const { data, error } = await api.content.menus({ id }).put({
      label: label.value,
      items: items.value,
    });
    saving.value = false;
    if (error) {
      return { ok: false, message: errorMessage(error, 'Échec de l’enregistrement') };
    }
    if (data) items.value = data.items;
    return { ok: true };
  }

  return { menu, handle, label, items, loading, saving, load, save };
}
