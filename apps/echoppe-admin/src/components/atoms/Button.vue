<script setup lang="ts">
import SpinnerIcon from './icons/SpinnerIcon.vue';

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    disabled: false,
    loading: false,
  }
);

defineEmits<{
  click: [event: MouseEvent];
}>();

const variantClasses: Record<string, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 border-transparent',
  secondary: 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-600 border-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-700 border-transparent',
  'danger-outline': 'bg-white border-red-200 text-red-600 hover:bg-red-50',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};
</script>

<template>
  <button
    :disabled="disabled || loading"
    :class="[
      'rounded-lg border font-medium transition cursor-pointer inline-flex items-center justify-center gap-2',
      variantClasses[variant],
      sizeClasses[size],
      (disabled || loading) && 'opacity-50 cursor-not-allowed'
    ]"
    @click="$emit('click', $event)"
  >
    <SpinnerIcon
      v-if="loading"
      size="sm"
    />
    <slot />
  </button>
</template>
