<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

interface HiddenColumn {
  id: string;
  label: string;
}

const props = defineProps<{
  hiddenColumns: HiddenColumn[];
}>();

const emit = defineEmits<{
  show: [columnId: string];
}>();

const isOpen = ref(false);
const menuRef = ref<HTMLDivElement | null>(null);
const buttonRef = ref<HTMLButtonElement | null>(null);

const hasHiddenColumns = computed(() => props.hiddenColumns.length > 0);

function toggle() {
  if (hasHiddenColumns.value) {
    isOpen.value = !isOpen.value;
  }
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

function showColumn(columnId: string) {
  emit('show', columnId);
  isOpen.value = false;
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
      class="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
      :class="{
        'text-gray-400 cursor-default': !hasHiddenColumns,
        'text-gray-600 hover:text-gray-800': hasHiddenColumns,
        'bg-gray-100': isOpen,
      }"
      :disabled="!hasHiddenColumns"
      :title="hasHiddenColumns ? 'Afficher une colonne' : 'Toutes les colonnes sont visibles'"
      @click.stop="toggle"
    >
      <svg
        class="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
        />
      </svg>
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
          Colonnes masquees
        </div>
        <button
          v-for="column in hiddenColumns"
          :key="column.id"
          class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
          @click="showColumn(column.id)"
        >
          <svg
            class="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          {{ column.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>
