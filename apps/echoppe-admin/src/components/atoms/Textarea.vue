<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    disabled?: boolean;
    rows?: number;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  {
    placeholder: undefined,
    disabled: false,
    rows: 3,
    size: 'md',
  }
);

defineEmits<{
  'update:modelValue': [value: string];
}>();

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-2.5 py-1.5 text-sm',
  lg: 'px-3 py-2 text-base',
};
</script>

<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows"
    :class="[
      'w-full border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none',
      sizeClasses[size],
      disabled && 'bg-gray-100 cursor-not-allowed opacity-60'
    ]"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
