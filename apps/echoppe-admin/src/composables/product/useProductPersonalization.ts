import { type ComputedRef, ref } from 'vue';
import { api } from '@/lib/api';
import type { PersonalizationField } from './types';

interface UseProductPersonalizationOptions {
  productId: ComputedRef<string | null>;
  onReload: () => Promise<void>;
}

// Gestion des champs de personnalisation d'un produit (ADR-0010) — CRUD via l'API, symétrique de
// useProductVariants. Le modal porte la création/édition ; le composable orchestre modal + suppression.
export function useProductPersonalization({
  productId,
  onReload,
}: UseProductPersonalizationOptions) {
  const showFieldModal = ref(false);
  const editingField = ref<PersonalizationField | null>(null);

  function openFieldModal(field?: PersonalizationField) {
    editingField.value = field ?? null;
    showFieldModal.value = true;
  }

  function closeFieldModal() {
    showFieldModal.value = false;
    editingField.value = null;
  }

  async function onFieldSaved() {
    await onReload();
    closeFieldModal();
  }

  async function deleteField(fieldId: string) {
    if (!productId.value) return;
    await api.products({ id: productId.value })['personalization-fields']({ fieldId }).delete();
    await onReload();
  }

  return {
    showFieldModal,
    editingField,
    openFieldModal,
    closeFieldModal,
    onFieldSaved,
    deleteField,
  };
}
