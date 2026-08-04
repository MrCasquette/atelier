import { useToast } from '@/composables/useToast';
import { api } from '@/lib/api';
import type { ApiItem } from '@/types/api';
import { ref } from 'vue';

// Ressource globale `/option-axes` (le catalogue d'axes). Nommée SANS le mot `options` :
// c'est un verbe HTTP réservé par Eden Treaty (la forme appel déclencherait un OPTIONS).
const axesApi = api['option-axes'];

// Types INFÉRÉS d'Eden.
export type Axis = ApiItem<ReturnType<typeof axesApi.get>>;
export type OptionValue = ApiItem<ReturnType<ReturnType<typeof axesApi>['values']['get']>>;
export type ColorMetadata = NonNullable<OptionValue['metadata']>;
export type AxisWithValues = Axis & { values: OptionValue[] };

// Message d'erreur Eden ({ status, value }) — les 409 (utilisée/dupliquée) portent un `message`.
function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'value' in error) {
    const value = (error as { value: unknown }).value;
    if (value && typeof value === 'object' && 'message' in value) {
      const message = (value as { message: unknown }).message;
      if (typeof message === 'string') return message;
    }
  }
  return fallback;
}

export function useOptionsCatalog() {
  const toast = useToast();
  const axes = ref<AxisWithValues[]>([]);
  const loading = ref(false);

  async function load() {
    loading.value = true;
    try {
      const { data } = await axesApi.get();
      if (!data) return;
      axes.value = await Promise.all(
        data.map(async (axis) => {
          const { data: values } = await axesApi({ optionId: axis.id }).values.get();
          return { ...axis, values: values ?? [] };
        }),
      );
    } finally {
      loading.value = false;
    }
  }

  async function createAxis(name: string, type: Axis['type']): Promise<boolean> {
    const { data, error } = await axesApi.post({ name, type });
    if (error || !data) {
      toast.error(errorMessage(error, "Création de l'axe impossible"));
      return false;
    }
    axes.value.push({ ...data, values: [] });
    return true;
  }

  async function updateAxis(
    axisId: string,
    patch: { name?: string; type?: Axis['type'] },
  ): Promise<boolean> {
    const { data, error } = await axesApi({ optionId: axisId }).put(patch);
    if (error || !data) {
      toast.error(errorMessage(error, "Mise à jour de l'axe impossible"));
      return false;
    }
    const axis = axes.value.find((a) => a.id === axisId);
    if (axis) {
      axis.name = data.name;
      // Passage color → string : le back a nettoyé les metadata, on reflète localement.
      if (axis.type === 'color' && data.type === 'string') {
        for (const v of axis.values) v.metadata = null;
      }
      axis.type = data.type;
    }
    return true;
  }

  async function deleteAxis(axisId: string): Promise<boolean> {
    const { error } = await axesApi({ optionId: axisId }).delete();
    if (error) {
      toast.error(errorMessage(error, "Suppression de l'axe impossible"));
      return false;
    }
    axes.value = axes.value.filter((a) => a.id !== axisId);
    return true;
  }

  async function addValue(
    axisId: string,
    value: string,
    metadata?: ColorMetadata,
  ): Promise<boolean> {
    const { data, error } = await axesApi({ optionId: axisId }).values.post({ value, metadata });
    if (error || !data) {
      toast.error(errorMessage(error, 'Ajout de la valeur impossible'));
      return false;
    }
    axes.value.find((a) => a.id === axisId)?.values.push(data);
    return true;
  }

  async function updateValue(
    axisId: string,
    valueId: string,
    patch: { value?: string; metadata?: ColorMetadata | null },
  ): Promise<boolean> {
    const { data, error } = await axesApi({ optionId: axisId }).values({ valueId }).put(patch);
    if (error || !data) {
      toast.error(errorMessage(error, 'Mise à jour de la valeur impossible'));
      return false;
    }
    const axis = axes.value.find((a) => a.id === axisId);
    const existing = axis?.values.find((v) => v.id === valueId);
    if (existing) {
      existing.value = data.value;
      existing.metadata = data.metadata;
    }
    return true;
  }

  async function deleteValue(axisId: string, valueId: string): Promise<boolean> {
    const { error } = await axesApi({ optionId: axisId }).values({ valueId }).delete();
    if (error) {
      toast.error(errorMessage(error, 'Suppression de la valeur impossible'));
      return false;
    }
    const axis = axes.value.find((a) => a.id === axisId);
    if (axis) axis.values = axis.values.filter((v) => v.id !== valueId);
    return true;
  }

  return {
    axes,
    loading,
    load,
    createAxis,
    updateAxis,
    deleteAxis,
    addValue,
    updateValue,
    deleteValue,
  };
}
