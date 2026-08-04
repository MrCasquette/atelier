<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

defineProps<{
  columnId: string;
  sortable?: boolean;
  hideable?: boolean;
  currentSort?: 'asc' | 'desc' | false;
}>();

const emit = defineEmits<{
  sortAsc: [];
  sortDesc: [];
  clearSort: [];
  hide: [];
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

function handleSortAsc() {
  emit('sortAsc');
  isOpen.value = false;
}

function handleSortDesc() {
  emit('sortDesc');
  isOpen.value = false;
}

function handleClearSort() {
  emit('clearSort');
  isOpen.value = false;
}

function handleHide() {
  emit('hide');
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
      class="p-1 rounded hover:bg-gray-200 transition-colors"
      :class="{ 'bg-gray-200': isOpen }"
      @click.stop="toggle"
    >
      <svg
        class="w-4 h-4 text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
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
        class="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
      >
        <template v-if="sortable">
          <button
            class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            :class="{ 'bg-blue-50 text-blue-700': currentSort === 'asc' }"
            @click="handleSortAsc"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
              />
            </svg>
            Trier croissant
          </button>
          <button
            class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            :class="{ 'bg-blue-50 text-blue-700': currentSort === 'desc' }"
            @click="handleSortDesc"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
              />
            </svg>
            Trier decroissant
          </button>
          <button
            v-if="currentSort"
            class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-500"
            @click="handleClearSort"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Retirer le tri
          </button>
          <div
            v-if="hideable"
            class="border-t border-gray-100 my-1"
          />
        </template>

        <button
          v-if="hideable"
          class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
          @click="handleHide"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
            />
          </svg>
          Masquer la colonne
        </button>
      </div>
    </Transition>
  </div>
</template>
