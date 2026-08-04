<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'default' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    title?: string;
  }>(),
  {
    variant: 'ghost',
    size: 'md',
    title: undefined,
  }
);

defineEmits<{
  click: [event: MouseEvent];
}>();

const variantClasses: Record<string, string> = {
  default: 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
  ghost: 'text-gray-400 hover:text-gray-600',
  danger: 'text-gray-400 hover:text-red-500',
};

const sizeClasses: Record<string, string> = {
  sm: 'p-0.5',
  md: 'p-1',
  lg: 'p-1.5',
};
</script>

<template>
  <button
    :title="title"
    :class="[
      'rounded transition cursor-pointer',
      variantClasses[variant],
      sizeClasses[size]
    ]"
    @click.stop="$emit('click', $event)"
  >
    <slot />
  </button>
</template>
