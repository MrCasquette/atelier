<script setup lang="ts">
import type { FilterOption } from './types';

withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    options: FilterOption[];
    placeholder?: string;
  }>(),
  {
    placeholder: 'Tous',
  }
);

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1">
      {{ label }}
    </label>
    <select
      :value="modelValue"
      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">
        {{ placeholder }}
      </option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>
