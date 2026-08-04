<script setup lang="ts">
import { ref } from 'vue';
import SearchIcon from '@/components/atoms/icons/SearchIcon.vue';

defineProps<{
  modelValue: string;
  placeholder?: string;
  shortcut?: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();

const inputRef = ref<HTMLInputElement | null>(null);

function focus() {
  inputRef.value?.focus();
}

defineExpose({ focus, inputRef });
</script>

<template>
  <div class="relative">
    <input
      ref="inputRef"
      type="text"
      :value="modelValue"
      :placeholder="placeholder || 'Rechercher...'"
      class="w-52 pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <SearchIcon
      size="sm"
      class="text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2"
    />
  </div>
</template>
