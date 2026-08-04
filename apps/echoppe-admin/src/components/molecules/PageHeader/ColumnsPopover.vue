<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import ColumnsIcon from '@/components/atoms/icons/ColumnsIcon.vue';
import type { ColumnInfo } from './types';

defineProps<{
  columns: ColumnInfo[];
}>();

const emit = defineEmits<{
  toggle: [columnId: string];
}>();

const isOpen = ref(false);
const menuRef = ref<HTMLDivElement | null>(null);
const buttonRef = ref<HTMLButtonElement | null>(null);

function toggle() {
  isOpen.value = !isOpen.value;
}

function handleClickOutside(event: MouseEvent) {
  if (
    menuRef.value &&
    !menuRef.value.contains(event.target as Node) &&
    buttonRef.value &&
    !buttonRef.value.contains(event.target as Node)
  ) {
    isOpen.value = false;
  }
}

function toggleColumn(columnId: string) {
  emit('toggle', columnId);
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="relative">
    <button
      ref="buttonRef"
      type="button"
      class="p-2 rounded-lg border transition-colors"
      :class="isOpen
        ? 'bg-blue-50 border-blue-200 text-blue-600'
        : 'border-gray-300 hover:bg-gray-50 text-gray-600'"
      title="Colonnes"
      @click.stop="toggle"
    >
      <ColumnsIcon size="sm" />
    </button>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        ref="menuRef"
        class="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
      >
        <div class="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
          Colonnes
        </div>
        <button
          v-for="column in columns"
          :key="column.id"
          class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
          @click="toggleColumn(column.id)"
        >
          <span
            class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
            :class="column.visible
              ? 'bg-blue-600 border-blue-600'
              : 'border-gray-300'"
          >
            <svg
              v-if="column.visible"
              class="w-3 h-3 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </span>
          <span :class="column.visible ? 'text-gray-900' : 'text-gray-500'">
            {{ column.label }}
          </span>
        </button>
      </div>
    </Transition>
  </div>
</template>
