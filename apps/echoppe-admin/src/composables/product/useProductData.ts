import { ref, computed } from 'vue';
import { api } from '@/lib/api';
import type { Category } from '@/composables/categories';
import type { TaxRate, Collection, SelectOption } from './types';

export function useProductData() {
  // State
  const categories = ref<Category[]>([]);
  const taxRates = ref<TaxRate[]>([]);
  const collections = ref<Collection[]>([]);
  const loading = ref(false);

  // Computed options for selects
  const categoryOptions = computed<SelectOption[]>(() =>
    categories.value.map((c) => ({ value: c.id, label: c.name }))
  );

  const taxRateOptions = computed<SelectOption[]>(() =>
    taxRates.value.map((t) => ({ value: t.id, label: `${t.name} (${t.rate}%)` }))
  );

  const collectionOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Aucune collection' },
    ...collections.value.map((c) => ({ value: c.id, label: c.name })),
  ]);

  const statusOptions: SelectOption[] = [
    { value: 'draft', label: 'Brouillon' },
    { value: 'published', label: 'Publié' },
    { value: 'archived', label: 'Archivé' },
  ];

  // Loaders
  async function loadCategories() {
    const { data } = await api.categories.get();
    if (data) categories.value = data;
  }

  async function loadTaxRates() {
    const { data } = await api['tax-rates'].get();
    if (data && Array.isArray(data)) taxRates.value = data;
  }

  async function loadCollections() {
    const { data } = await api.collections.get({ query: { limit: 100 } });
    if (data && 'data' in data) collections.value = data.data;
  }

  async function loadAll() {
    loading.value = true;
    await Promise.all([loadCategories(), loadTaxRates(), loadCollections()]);
    loading.value = false;
  }

  // Helpers
  function getDefaultCategory(): string {
    return categories.value[0]?.id || '';
  }

  function getDefaultTaxRate(): string {
    return taxRates.value.find((t) => t.isDefault)?.id || taxRates.value[0]?.id || '';
  }

  return {
    // State
    categories,
    taxRates,
    collections,
    loading,

    // Computed
    categoryOptions,
    taxRateOptions,
    collectionOptions,
    statusOptions,

    // Actions
    loadCategories,
    loadTaxRates,
    loadCollections,
    loadAll,

    // Helpers
    getDefaultCategory,
    getDefaultTaxRate,
  };
}
