// Les entités que l'appelant peut administrer (GET /content/entities/mine). Cache module-level :
// la navigation et les écrans lisent la même liste, et elle ne change qu'au push du dev.
//
// Le journal complet vit ailleurs et tient à `schema:read` — ici on ne voit que ce qu'on détient.
import { ref } from 'vue';
import { api } from '@/lib/api';
import type { EntityAction, GrantedEntity } from './types';

const entities = ref<GrantedEntity[]>([]);
const loading = ref(false);
let loaded = false;

export function useEntities() {
  async function load(force = false) {
    if ((loaded || loading.value) && !force) return;
    loading.value = true;
    // Un 403 (principal non privilégié) laisse la liste vide : rien à administrer, pas une panne.
    const { data } = await api.content.entities.mine.get();
    if (data) {
      entities.value = data.entities;
      loaded = true;
    }
    loading.value = false;
  }

  function byName(name: string): GrantedEntity | null {
    return entities.value.find((entity) => entity.name === name) ?? null;
  }

  function can(entity: GrantedEntity | null, action: EntityAction): boolean {
    return entity?.actions.includes(action) ?? false;
  }

  return { entities, loading, load, byName, can };
}
