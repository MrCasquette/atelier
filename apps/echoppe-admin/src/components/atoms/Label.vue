<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg';
    required?: boolean;
  }>(),
  {
    size: 'md',
    required: false,
  }
);

const sizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};
</script>

<template>
  <label :class="['block font-medium text-gray-500 mb-1', sizeClasses[size]]">
    <slot />
    <span
      v-if="required"
      class="text-red-500 ml-0.5"
    >*</span>
  </label>
</template>
