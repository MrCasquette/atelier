<script setup lang="ts">
import type { BatchAction } from './types';
import CloseIcon from '@/components/atoms/icons/CloseIcon.vue';
import TrashIcon from '@/components/atoms/icons/TrashIcon.vue';
import EditIcon from '@/components/atoms/icons/EditIcon.vue';

defineProps<{
  selectedCount: number;
  actions: BatchAction[];
}>();

defineEmits<{
  action: [actionId: string];
  clear: [];
}>();
</script>

<template>
  <div class="flex items-center gap-3">
    <span class="text-sm font-medium text-blue-600">
      {{ selectedCount }} selectionne{{ selectedCount > 1 ? 's' : '' }}
    </span>
    <div class="flex items-center gap-1">
      <button
        v-for="action in actions"
        :key="action.id"
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer"
        :class="action.variant === 'danger'
          ? 'text-red-600 hover:bg-red-50'
          : 'text-gray-700 hover:bg-gray-100'"
        @click.stop="$emit('action', action.id)"
      >
        <TrashIcon
          v-if="action.icon === 'trash'"
          size="sm"
        />
        <svg
          v-else-if="action.icon === 'archive'"
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          />
        </svg>
        <EditIcon
          v-else-if="action.icon === 'edit'"
          size="sm"
        />
        {{ action.label }}
      </button>
      <button
        class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer ml-1"
        title="Annuler la selection"
        @click="$emit('clear')"
      >
        <CloseIcon size="sm" />
      </button>
    </div>
  </div>
</template>
