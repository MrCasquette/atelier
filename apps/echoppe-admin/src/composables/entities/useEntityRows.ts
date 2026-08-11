// Les occurrences d'UNE entité : lister, créer, modifier, supprimer. Une seule route générique
// côté serveur (`/content/entities/:name/rows`), gardée par `entity:<nom>`.
import { type MaybeRefOrGetter, ref, toValue } from 'vue';
import { api } from '@/lib/api';
import { errorMessage, type SaveResult } from '@/lib/apiError';
import type { EntityRow } from './types';

/** Ce qui part en écriture : la donnée des champs est nichée sous `data`, le slug ne l'est pas. */
export interface EntityRowInput {
  slug?: string;
  data: Record<string, unknown>;
}

// `name` est réactif : l'écran d'une entité se réutilise d'une entité à l'autre (même route, autre
// paramètre), et une valeur figée à la création lirait la mauvaise table.
export function useEntityRows(name: MaybeRefOrGetter<string>) {
  const entityName = () => toValue(name);
  const rows = ref<EntityRow[]>([]);
  const loading = ref(true);
  const saving = ref(false);
  /** Renseigné quand le serveur a refusé la lecture : un droit à accorder, pas une panne. */
  const denied = ref(false);

  async function load() {
    loading.value = true;
    denied.value = false;
    const { data, error } = await api.content.entities({ name: entityName() }).rows.get({ query: {} });
    if (data) rows.value = data.data;
    if (error) denied.value = error.status === 403;
    loading.value = false;
  }

  async function createRow(input: EntityRowInput): Promise<SaveResult> {
    saving.value = true;
    const { error } = await api.content.entities({ name: entityName() }).rows.post(input);
    saving.value = false;
    if (error) return { ok: false, message: errorMessage(error, "Échec de l'enregistrement") };
    await load();
    return { ok: true };
  }

  async function updateRow(id: string, input: EntityRowInput): Promise<SaveResult> {
    saving.value = true;
    const { error } = await api.content.entities({ name: entityName() }).rows({ id }).put(input);
    saving.value = false;
    if (error) return { ok: false, message: errorMessage(error, "Échec de l'enregistrement") };
    await load();
    return { ok: true };
  }

  async function deleteRow(id: string): Promise<SaveResult> {
    const { error } = await api.content.entities({ name: entityName() }).rows({ id }).delete();
    if (error) return { ok: false, message: errorMessage(error, 'Échec de la suppression') };
    await load();
    return { ok: true };
  }

  return { rows, loading, saving, denied, load, createRow, updateRow, deleteRow };
}
