// État d'édition d'un menu : libellé + arbre d'items récursif. La validation fine (shape récursif)
// est faite côté serveur (menuItemsSchema) → message d'erreur remonté tel quel.
import { ref } from 'vue';
import { api } from '@/lib/api';
import type { MenuDetail, MenuItem } from './menuTypes';

export interface SaveResult {
  ok: boolean;
  message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: { value: unknown }, fallback: string): string {
  const value = error.value;
  if (isRecord(value) && typeof value.message === 'string') return value.message;
  return fallback;
}

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
