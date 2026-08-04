<script setup lang="ts">
import CloseIcon from './icons/CloseIcon.vue';
import { useModalStack } from '@/composables/useModalStack';

withDefaults(
  defineProps<{
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    tall?: boolean;
  }>(),
  {
    title: undefined,
    size: 'sm',
    tall: false,
  }
);

defineEmits<{
  close: [];
}>();

const { zIndex } = useModalStack();

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-3xl',
  '2xl': 'max-w-5xl',
};
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 bg-black/50 flex items-center justify-center"
      :style="{ zIndex }"
      @click.self="$emit('close')"
    >
      <div :class="['bg-white rounded-lg shadow-xl w-full mx-4 max-h-[90vh] flex flex-col', sizeClasses[size], tall && 'min-h-[80vh]']">
        <div
          v-if="title || $slots.header"
          class="flex items-start justify-between p-5 pb-0 shrink-0"
        >
          <slot name="header">
            <h2 class="text-lg font-semibold">
              {{ title }}
            </h2>
          </slot>
          <button
            class="text-gray-400 hover:text-gray-600 p-1 -mt-1 -mr-1"
            @click="$emit('close')"
          >
            <CloseIcon />
          </button>
        </div>
        <div class="p-5 flex-1 overflow-auto">
          <slot />
        </div>
        <div
          v-if="$slots.footer"
          class="px-5 pb-5 shrink-0 border-t border-gray-100 pt-4"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
