<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}>();

const emit = defineEmits<{
  'update:page': [page: number];
}>();

const canGoPrevious = computed(() => props.page > 1);
const canGoNext = computed(() => props.page < props.totalPages);

const startItem = computed(() => (props.page - 1) * props.limit + 1);
const endItem = computed(() => Math.min(props.page * props.limit, props.total));

const visiblePages = computed(() => {
  const pages: (number | 'ellipsis')[] = [];
  const { page, totalPages } = props;

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  pages.push(1);

  if (page > 3) pages.push('ellipsis');

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (page < totalPages - 2) pages.push('ellipsis');

  pages.push(totalPages);

  return pages;
});

function goToPage(page: number) {
  if (page >= 1 && page <= props.totalPages) {
    emit('update:page', page);
  }
}
</script>

<template>
  <div class="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
    <!-- Info mobile -->
    <div class="flex flex-1 justify-between sm:hidden">
      <button
        :disabled="!canGoPrevious"
        class="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        @click="goToPage(page - 1)"
      >
        Précédent
      </button>
      <button
        :disabled="!canGoNext"
        class="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        @click="goToPage(page + 1)"
      >
        Suivant
      </button>
    </div>

    <!-- Desktop -->
    <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
      <div>
        <p class="text-sm text-gray-700">
          <span class="font-medium">{{ startItem }}</span>
          -
          <span class="font-medium">{{ endItem }}</span>
          sur
          <span class="font-medium">{{ total }}</span>
          résultats
        </p>
      </div>

      <nav
        v-if="totalPages > 1"
        class="isolate inline-flex -space-x-px rounded-md shadow-sm"
      >
        <!-- Previous -->
        <button
          :disabled="!canGoPrevious"
          class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          @click="goToPage(page - 1)"
        >
          <span class="sr-only">Précédent</span>
          <svg
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
              clip-rule="evenodd"
            />
          </svg>
        </button>

        <!-- Page numbers -->
        <template
          v-for="(p, index) in visiblePages"
          :key="index"
        >
          <span
            v-if="p === 'ellipsis'"
            class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300"
          >
            ...
          </span>
          <span
            v-else-if="p === page"
            class="relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 z-10 bg-indigo-600 text-white"
          >
            {{ p }}
          </span>
          <button
            v-else
            class="relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 cursor-pointer text-gray-900 hover:bg-gray-50"
            @click="goToPage(p)"
          >
            {{ p }}
          </button>
        </template>

        <!-- Next -->
        <button
          :disabled="!canGoNext"
          class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          @click="goToPage(page + 1)"
        >
          <span class="sr-only">Suivant</span>
          <svg
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </nav>
    </div>
  </div>
</template>
