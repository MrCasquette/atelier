<script setup lang="ts">
import { computed, inject } from 'vue';
import IconButton from '@/components/atoms/IconButton.vue';
import Button from '@/components/atoms/Button.vue';
import DynamicForm from './DynamicForm.vue';
import { emptyFieldsData, registryKey } from '@/composables/content/registry';
import { asRecord } from '@/composables/content/coerce';
import type { BlockData, SerializedField } from '@/composables/content/types';

// Répétition de champs (kind `list` = component nommé, kind `repeater` = groupe inline). Gère
// l'ajout/suppression/réordonnancement d'items, chacun édité par un DynamicForm imbriqué. Bornes
// min/max respectées (ajout désactivé au max, suppression au min). Mise à jour immuable.
const props = defineProps<{
  fields: Record<string, SerializedField>;
  modelValue: unknown[];
  min?: number;
  max?: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: unknown[]];
}>();

const registry = inject(registryKey);

const canAdd = computed(() => props.max === undefined || props.modelValue.length < props.max);
const canRemove = computed(() => props.min === undefined || props.modelValue.length > props.min);

function addItem() {
  if (!registry || !canAdd.value) return;
  emit('update:modelValue', [...props.modelValue, emptyFieldsData(props.fields, registry)]);
}

function updateItem(index: number, value: BlockData) {
  const next = props.modelValue.slice();
  next[index] = value;
  emit('update:modelValue', next);
}

function removeItem(index: number) {
  if (!canRemove.value) return;
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index));
}

function move(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= props.modelValue.length) return;
  const next = props.modelValue.slice();
  [next[index], next[target]] = [next[target], next[index]];
  emit('update:modelValue', next);
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="(item, index) in modelValue"
      :key="index"
      class="rounded-md border border-gray-200 p-3"
    >
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs font-medium text-gray-400">#{{ index + 1 }}</span>
        <div class="flex items-center gap-1">
          <IconButton
            aria-label="Monter"
            :disabled="index === 0"
            @click="move(index, -1)"
          >
            ↑
          </IconButton>
          <IconButton
            aria-label="Descendre"
            :disabled="index === modelValue.length - 1"
            @click="move(index, 1)"
          >
            ↓
          </IconButton>
          <IconButton
            aria-label="Supprimer"
            :disabled="!canRemove"
            @click="removeItem(index)"
          >
            ✕
          </IconButton>
        </div>
      </div>
      <DynamicForm
        :fields="fields"
        :model-value="asRecord(item)"
        @update:model-value="updateItem(index, $event)"
      />
    </div>

    <Button
      variant="secondary"
      size="sm"
      :disabled="!canAdd"
      @click="addItem"
    >
      + Ajouter
    </Button>
  </div>
</template>
