// Les cibles référençables, telles que l'API les déclare (ADR-0032).
//
// L'administration ne connaît plus « produit, collection, catégorie, page » : elle demande. Ce qui
// permet à un dev d'ajouter une entité référençable sans toucher à l'admin, et à Prisme de servir
// le même écran avec d'autres cibles.
//
// Chargées une fois pour toute la session : le registre ne bouge pas en cours de route, et le
// sélecteur de lien est ouvert à chaque item de menu.
import { readonly, ref } from 'vue';
import { api } from '@/lib/api';
import type { ApiItem } from '@/types/api';

export type ReferenceTarget = ApiItem<ReturnType<typeof api.content['reference-targets']['get']>>;

const targets = ref<ReferenceTarget[]>([]);
const loading = ref(false);
// Garde de concurrence : plusieurs sélecteurs montés ensemble ne doivent lancer qu'une requête.
let inflight: Promise<void> | null = null;

async function fetchTargets(): Promise<void> {
  loading.value = true;
  try {
    const { data } = await api.content['reference-targets'].get();
    targets.value = data ?? [];
  } finally {
    loading.value = false;
  }
}

export function useReferenceTargets() {
  async function load(): Promise<void> {
    if (targets.value.length > 0) return;
    inflight ??= fetchTargets().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  function labelOf(name: string): string {
    return targets.value.find((target) => target.name === name)?.label ?? name;
  }

  return { targets: readonly(targets), loading: readonly(loading), load, labelOf };
}
