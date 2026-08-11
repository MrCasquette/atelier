// Ce dont tout écran d'entité a besoin avant de rendre quoi que ce soit : la déclaration (qui dit
// s'il faut une liste ou un formulaire, et quels champs générer) et le registre des définitions
// (que la récursion du générateur consulte pour les `component`/`list`).
//
// La déclaration peut manquer pour deux raisons qui ne se distinguent pas d'ici, et c'est voulu :
// l'entité n'existe pas, ou elle ne vous est pas accordée. Le serveur ne dit pas laquelle — dire
// « celle-ci existe mais vous n'y avez pas droit » renseignerait sur ce qu'on ne détient pas.
import { computed, type MaybeRefOrGetter, onMounted, ref, toValue } from 'vue';
import { useContentRegistry } from '@/composables/content/useContentRegistry';
import { useEntities } from './useEntities';

export function useEntityScreen(name: MaybeRefOrGetter<string>) {
  const { load: loadEntities, byName, can } = useEntities();
  const { registry, load: loadRegistry } = useContentRegistry();
  const ready = ref(false);

  const declaration = computed(() => byName(toValue(name)));
  const title = computed(() => declaration.value?.label ?? toValue(name));

  onMounted(async () => {
    await Promise.all([loadEntities(), loadRegistry()]);
    ready.value = true;
  });

  return { declaration, registry, ready, title, can };
}
