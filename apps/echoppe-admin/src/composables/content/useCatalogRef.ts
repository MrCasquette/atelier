// Accès à une cible référençable pour un champ de référence : recherche d'entités et résolution
// d'un libellé depuis un UUID.
//
// Ce composable énumérait les quatre cibles d'Échoppe et appelait un endpoint catalogue différent
// pour chacune — huit appels codés en dur, la contrepartie admin du couplage d'ADR-0032. Il passe
// désormais par le registre : deux endpoints génériques, aucune entité nommée ici.
import { computed, ref } from 'vue';
import { api } from '@/lib/api';
import type { ApiItem } from '@/types/api';
import { useReferenceTargets } from './useReferenceTargets';

export type RefOption = ApiItem<
  ReturnType<ReturnType<typeof api.content['reference-targets']>['options']['get']>
>;

const SEARCH_LIMIT = 20;

export function useCatalogRef(target: string) {
  const { load, labelOf } = useReferenceTargets();
  const options = ref<RefOption[]>([]);
  const loading = ref(false);

  void load();

  async function search(term: string) {
    loading.value = true;
    try {
      const { data } = await api.content['reference-targets']({ name: target }).options.get({
        query: { search: term || undefined, limit: SEARCH_LIMIT },
      });
      options.value = data ?? [];
    } finally {
      loading.value = false;
    }
  }

  /** Libellé d'une référence déjà sélectionnée (affichage du chip). */
  async function resolveLabel(id: string): Promise<string | null> {
    const { data } = await api.content['reference-targets']({ name: target }).entities.get({
      query: { ids: id },
    });
    return data?.[0]?.name ?? null;
  }

  return {
    options,
    loading,
    search,
    resolveLabel,
    targetLabel: computed(() => labelOf(target)),
  };
}
