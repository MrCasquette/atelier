<script setup lang="ts">
import Label from '@/components/atoms/Label.vue';
import FieldControl from './FieldControl.vue';
import type { BlockData, SerializedField } from '@/composables/content/types';

// Générateur de formulaire registre-dirigé : rend un contrôle par champ d'une définition. Récursif
// via FieldControl (component/list/repeater). Mise à jour immuable — chaque changement émet un
// nouvel objet, la réactivité remonte jusqu'au bloc.
const props = defineProps<{
  fields: Record<string, SerializedField>;
  modelValue: BlockData;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: BlockData];
}>();

function setField(name: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [name]: value });
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="(field, name) in fields"
      :key="name"
    >
      <Label :required="field.required">{{ field.label ?? name }}</Label>
      <FieldControl
        :field="field"
        :model-value="modelValue[name]"
        @update:model-value="setField(name, $event)"
      />
      <p
        v-if="field.hint"
        class="mt-1 text-xs text-gray-400"
      >
        {{ field.hint }}
      </p>
    </div>
  </div>
</template>
