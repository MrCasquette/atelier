<script setup lang="ts">
withDefaults(
  defineProps<{
    checked: boolean;
    size?: 'sm' | 'md';
    variant?: 'default' | 'overlay';
  }>(),
  {
    size: 'md',
    variant: 'default',
  }
);

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<template>
  <div
    :class="[
      'rounded border-2 flex items-center justify-center cursor-pointer transition-colors',
      size === 'sm' ? 'w-4 h-4' : 'w-5 h-5',
      checked
        ? 'bg-blue-600 border-blue-600'
        : variant === 'overlay'
          ? 'bg-white/90 border-gray-300 shadow-sm'
          : 'border-gray-300'
    ]"
    @click.stop="$emit('click', $event)"
  >
    <svg
      v-if="checked"
      :class="size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'"
      class="text-white"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fill-rule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clip-rule="evenodd"
      />
    </svg>
  </div>
</template>
