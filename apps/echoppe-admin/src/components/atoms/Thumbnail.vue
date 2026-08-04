<script setup lang="ts">
withDefaults(
  defineProps<{
    src?: string | null;
    alt?: string;
    isImage?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'full';
  }>(),
  {
    src: undefined,
    alt: '',
    isImage: true,
    size: 'full',
  }
);

const sizeClasses: Record<string, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  full: 'w-full h-full',
};

const iconSizeClasses: Record<string, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  full: 'w-8 h-8',
};
</script>

<template>
  <div
    :class="[
      sizeClasses[size],
      'bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0'
    ]"
  >
    <img
      v-if="isImage && src"
      :src="src"
      :alt="alt"
      class="w-full h-full object-cover"
      loading="lazy"
    />
    <svg
      v-else
      :class="iconSizeClasses[size]"
      class="text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  </div>
</template>
