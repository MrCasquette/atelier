<script setup lang="ts">
defineProps<{
  modelValue: 'small' | 'medium' | 'large';
}>();

defineEmits<{
  'update:modelValue': [value: 'small' | 'medium' | 'large'];
}>();

const sizes = ['small', 'medium', 'large'] as const;

const labels: Record<typeof sizes[number], string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
};
</script>

<template>
  <div class="flex border border-gray-300 rounded-lg overflow-hidden">
    <button
      v-for="size in sizes"
      :key="size"
      :class="['px-2 py-1 text-xs', modelValue === size ? 'bg-gray-100' : 'hover:bg-gray-50']"
      @click="$emit('update:modelValue', size)"
    >
      {{ labels[size] }}
    </button>
  </div>
</template>
