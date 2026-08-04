<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string;
    type?: 'text' | 'email' | 'password' | 'number' | 'url';
    placeholder?: string;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  {
    type: 'text',
    placeholder: undefined,
    disabled: false,
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
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="[
      'w-full border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent transition',
      sizeClasses[size],
      disabled && 'bg-gray-100 cursor-not-allowed opacity-60'
    ]"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
