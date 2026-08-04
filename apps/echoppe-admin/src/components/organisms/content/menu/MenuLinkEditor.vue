<script setup lang="ts">
import Input from '@/components/atoms/Input.vue';
import Select from '@/components/atoms/Select.vue';
import Toggle from '@/components/atoms/Toggle.vue';
import CatalogRefPicker from '../CatalogRefPicker.vue';
import type { MenuLink, MenuLinkTarget } from '@/composables/content/menuTypes';

// Éditeur du lien d'un item de menu : cible (URL externe ou entité interne) + valeur + nouvel
// onglet. Changer de cible réinitialise la valeur (URL string vs UUID d'entité).
const props = defineProps<{
  modelValue: MenuLink;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: MenuLink];
}>();

const targetOptions = [
  { value: 'url', label: 'URL externe' },
  { value: 'page', label: 'Page' },
  { value: 'product', label: 'Produit' },
  { value: 'collection', label: 'Collection' },
  { value: 'category', label: 'Catégorie' },
];

const TARGETS: readonly string[] = ['url', 'page', 'product', 'collection', 'category'];
const isTarget = (value: string): value is MenuLinkTarget => TARGETS.includes(value);

function setTarget(value: string) {
  if (!isTarget(value) || value === props.modelValue.target) return;
  // Reset de la valeur : une URL et un UUID ne sont pas interchangeables.
  emit('update:modelValue', { ...props.modelValue, target: value, value: '' });
}

function setValue(value: string | null) {
  emit('update:modelValue', { ...props.modelValue, value: value ?? '' });
}

function setNewTab(newTab: boolean) {
  emit('update:modelValue', { ...props.modelValue, newTab });
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <div class="w-40 shrink-0">
        <Select
          :model-value="modelValue.target"
          :options="targetOptions"
          size="sm"
          @update:model-value="setTarget"
        />
      </div>
      <Input
        v-if="modelValue.target === 'url'"
        :model-value="modelValue.value"
        placeholder="https://…"
        size="sm"
        class="flex-1"
        @update:model-value="setValue"
      />
      <div
        v-else
        class="flex-1"
      >
        <CatalogRefPicker
          :model-value="modelValue.value || null"
          :to="modelValue.target"
          @update:model-value="setValue"
        />
      </div>
    </div>
    <label class="flex w-fit items-center gap-2 text-xs text-gray-500">
      <Toggle
        :model-value="modelValue.newTab ?? false"
        size="sm"
        @update:model-value="setNewTab"
      />
      Ouvrir dans un nouvel onglet
    </label>
  </div>
</template>
