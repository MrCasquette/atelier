<script setup lang="ts">
import type { BadgeVariant } from '@/types/ui';

withDefaults(
  defineProps<{
    variant?: BadgeVariant;
    size?: 'sm' | 'md';
  }>(),
  {
    variant: 'default',
    size: 'md',
  }
);

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  default: 'bg-gray-100 text-gray-800',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-1 text-xs',
};
</script>

<template>
  <span
    :class="[
      'inline-flex items-center font-medium rounded-full whitespace-nowrap',
      variantClasses[variant],
      sizeClasses[size],
    ]"
  >
    <slot />
  </span>
</template>
