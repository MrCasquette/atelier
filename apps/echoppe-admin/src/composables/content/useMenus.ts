// Liste des menus de navigation (CRUD léger : lister, créer, supprimer). L'édition de l'arbre
// d'items vit dans useMenuEditor.
import { ref } from 'vue';
import { api } from '@/lib/api';
import type { MenuDetail, MenuListItem } from './menuTypes';

export function useMenus() {
  const menus = ref<MenuListItem[]>([]);
  const loading = ref(true);
  const saving = ref(false);

  async function load() {
    loading.value = true;
    const { data } = await api.content.menus.get();
    if (data) menus.value = data;
    loading.value = false;
  }

  async function createMenu(input: { handle: string; label: string }): Promise<MenuDetail | null> {
    saving.value = true;
    const { data, error } = await api.content.menus.post(input);
    saving.value = false;
    if (!error && data) {
      await load();
      return data;
    }
    return null;
  }

  async function deleteMenu(id: string): Promise<boolean> {
    const { error } = await api.content.menus({ id }).delete();
    if (!error) {
      await load();
      return true;
    }
    return false;
  }

  return { menus, loading, saving, load, createMenu, deleteMenu };
}
