<script setup lang="ts">
import Label from '@/components/atoms/Label.vue';
import FieldControl from './FieldControl.vue';
import type { BlockData, SerializedField } from '@/composables/content/types';

// Générateur de formulaire registre-dirigé : rend un contrôle par champ d'une définition. Récursif
// via FieldControl (component/list/repeater). Mise à jour immuable — chaque changement émet un
// nouvel objet, la réactivité remonte jusqu'au bloc.
//
// L'ordre de `fields` EST l'ordre d'affichage : c'est ce composant qui donne son sens à la séquence
// d'ADR-0049, et c'est ici que le désordre se voyait quand la déclaration était un objet.
const props = defineProps<{
  fields: readonly SerializedField[];
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
      v-for="field in fields"
      :key="field.name"
    >
      <Label :required="field.required">{{ field.label ?? field.name }}</Label>
      <FieldControl
        :field="field"
        :model-value="modelValue[field.name]"
        @update:model-value="setField(field.name, $event)"
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
