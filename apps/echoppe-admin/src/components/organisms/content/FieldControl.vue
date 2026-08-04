<script setup lang="ts">
import { inject } from 'vue';
import Input from '@/components/atoms/Input.vue';
import Textarea from '@/components/atoms/Textarea.vue';
import Select from '@/components/atoms/Select.vue';
import Checkbox from '@/components/atoms/Checkbox.vue';
import Toggle from '@/components/atoms/Toggle.vue';
import DatePicker from '@/components/molecules/DatePicker.vue';
import MediaPicker from '@/components/molecules/MediaPicker.vue';
import CatalogRefPicker from './CatalogRefPicker.vue';
import DynamicForm from './DynamicForm.vue';
import FieldRepeater from './FieldRepeater.vue';
import { registryKey } from '@/composables/content/registry';
import {
  asArray,
  asBool,
  asNumberOrNull,
  asRecord,
  asString,
  asStringArray,
  asStringOrNull,
  parseNumberInput,
} from '@/composables/content/coerce';
import type { SerializedField } from '@/composables/content/types';

// Dispatch registre-dirigé : rend le widget correspondant au `kind` du champ. Récursif pour
// `component`/`list`/`repeater` (réinjecte DynamicForm/FieldRepeater). La donnée transite en
// `unknown`, coercée par garde vers le type attendu par chaque widget.
const props = defineProps<{
  field: SerializedField;
  modelValue: unknown;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: unknown];
}>();

const registry = inject(registryKey);

const update = (value: unknown) => emit('update:modelValue', value);

// Champ `text` : mappe un éventuel `format` email/url vers le type d'input natif.
function inputType(format?: string): 'text' | 'email' | 'url' {
  if (format === 'email') return 'email';
  if (format === 'url') return 'url';
  return 'text';
}

// Résout les champs d'un component nommé (list/component) depuis le registre.
function componentFields(name: string): Record<string, SerializedField> | null {
  return registry?.components[name]?.fields ?? null;
}

// Enum multiple : bascule la présence d'une valeur dans le tableau sélectionné.
function toggleEnum(value: string) {
  const current = asStringArray(props.modelValue);
  update(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
}
</script>

<template>
  <!-- text -->
  <Input
    v-if="field.kind === 'text'"
    :type="inputType(field.format)"
    :model-value="asString(modelValue)"
    :placeholder="field.placeholder"
    @update:model-value="update"
  />

  <!-- richText (source Markdown) -->
  <Textarea
    v-else-if="field.kind === 'richText'"
    :model-value="asString(modelValue)"
    :placeholder="field.placeholder"
    :rows="6"
    @update:model-value="update"
  />

  <!-- number -->
  <Input
    v-else-if="field.kind === 'number'"
    type="number"
    :model-value="asNumberOrNull(modelValue) === null ? '' : String(asNumberOrNull(modelValue))"
    :placeholder="field.placeholder"
    @update:model-value="update(parseNumberInput($event, field.integer))"
  />

  <!-- boolean -->
  <Toggle
    v-else-if="field.kind === 'boolean'"
    :model-value="asBool(modelValue)"
    @update:model-value="update"
  />

  <!-- date -->
  <DatePicker
    v-else-if="field.kind === 'date'"
    :model-value="asString(modelValue)"
    :time="field.time"
    @update:model-value="update"
  />

  <!-- enum single -->
  <Select
    v-else-if="field.kind === 'enum' && !field.multiple"
    :model-value="asString(modelValue)"
    :options="field.options"
    placeholder="Choisir…"
    @update:model-value="update"
  />

  <!-- enum multiple -->
  <div
    v-else-if="field.kind === 'enum'"
    class="flex flex-wrap gap-x-4 gap-y-2"
  >
    <label
      v-for="option in field.options"
      :key="option.value"
      class="flex items-center gap-2 text-sm cursor-pointer"
    >
      <Checkbox
        :checked="asStringArray(modelValue).includes(option.value)"
        size="sm"
        @click="toggleEnum(option.value)"
      />
      {{ option.label }}
    </label>
  </div>

  <!-- image -->
  <MediaPicker
    v-else-if="field.kind === 'image'"
    :model-value="asStringOrNull(modelValue)"
    @update:model-value="update"
  />

  <!-- ref -->
  <CatalogRefPicker
    v-else-if="field.kind === 'ref'"
    :model-value="asStringOrNull(modelValue)"
    :to="field.to"
    @update:model-value="update"
  />

  <!-- component (imbriqué) -->
  <div
    v-else-if="field.kind === 'component'"
    class="rounded-md border border-gray-200 bg-gray-50/50 p-3"
  >
    <DynamicForm
      v-if="componentFields(field.of)"
      :fields="componentFields(field.of) || {}"
      :model-value="asRecord(modelValue)"
      @update:model-value="update"
    />
    <p
      v-else
      class="text-xs text-red-500"
    >
      Composant « {{ field.of }} » introuvable dans le registre.
    </p>
  </div>

  <!-- list (répétition d'un component) -->
  <FieldRepeater
    v-else-if="field.kind === 'list'"
    :fields="componentFields(field.of) ?? {}"
    :model-value="asArray(modelValue)"
    :min="field.min"
    :max="field.max"
    @update:model-value="update"
  />

  <!-- repeater (groupe inline) -->
  <FieldRepeater
    v-else-if="field.kind === 'repeater'"
    :fields="field.fields"
    :model-value="asArray(modelValue)"
    :min="field.min"
    :max="field.max"
    @update:model-value="update"
  />
</template>
