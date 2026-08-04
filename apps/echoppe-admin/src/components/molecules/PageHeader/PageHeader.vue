<script setup lang="ts">
import { useSlots } from 'vue';
import type { BatchAction, ColumnInfo } from './types';
import SearchInput from '@/components/molecules/SearchInput.vue';
import Button from '@/components/atoms/Button.vue';
import FilterIcon from '@/components/atoms/icons/FilterIcon.vue';
import PlusIcon from '@/components/atoms/icons/PlusIcon.vue';
import BatchActions from './BatchActions.vue';
import FilterPanel from './FilterPanel.vue';
import ColumnsPopover from './ColumnsPopover.vue';

withDefaults(
  defineProps<{
    totalItems: number;
    itemLabel?: string;
    itemLabelPlural?: string;
    searchable?: boolean;
    searchValue?: string;
    searchPlaceholder?: string;
    filterable?: boolean;
    filtersOpen?: boolean;
    activeFiltersCount?: number;
    showAdd?: boolean;
    addLabel?: string;
    selectedCount?: number;
    batchActions?: BatchAction[];
    columns?: ColumnInfo[];
  }>(),
  {
    itemLabel: 'element',
    itemLabelPlural: 'elements',
    searchable: true,
    searchValue: '',
    searchPlaceholder: 'Rechercher...',
    filterable: false,
    filtersOpen: false,
    activeFiltersCount: 0,
    showAdd: false,
    addLabel: 'Ajouter',
    selectedCount: 0,
    batchActions: () => [],
    columns: () => [],
  }
);

const emit = defineEmits<{
  'update:searchValue': [value: string];
  'update:filtersOpen': [open: boolean];
  add: [];
  batchAction: [actionId: string];
  clearSelection: [];
  applyFilters: [];
  resetFilters: [];
  toggleColumn: [columnId: string];
}>();

const slots = useSlots();
</script>

<template>
  <div class="mb-4">
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500">
          {{ totalItems }} {{ totalItems > 1 ? itemLabelPlural : itemLabel }}
        </span>

        <BatchActions
          v-if="selectedCount > 0"
          :selected-count="selectedCount"
          :actions="batchActions"
          @action="emit('batchAction', $event)"
          @clear="emit('clearSelection')"
        />
      </div>

      <div class="flex items-center gap-2">
        <SearchInput
          v-if="searchable"
          :model-value="searchValue"
          :placeholder="searchPlaceholder"
          @update:model-value="emit('update:searchValue', $event)"
        />

        <button
          v-if="filterable"
          type="button"
          class="relative p-2 rounded-lg border transition-colors"
          :class="filtersOpen
            ? 'bg-blue-50 border-blue-200 text-blue-600'
            : 'border-gray-300 hover:bg-gray-50 text-gray-600'"
          title="Filtres"
          @click="emit('update:filtersOpen', !filtersOpen)"
        >
          <FilterIcon size="sm" />
          <span
            v-if="activeFiltersCount > 0"
            class="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-blue-600 rounded-full"
          >
            {{ activeFiltersCount }}
          </span>
        </button>

        <ColumnsPopover
          v-if="columns.length > 0"
          :columns="columns"
          @toggle="emit('toggleColumn', $event)"
        />

        <slot name="actions" />

        <Button
          v-if="showAdd"
          variant="primary"
          @click="emit('add')"
        >
          <PlusIcon size="sm" />
          {{ addLabel }}
        </Button>
      </div>
    </div>

    <FilterPanel
      v-if="filterable && filtersOpen && slots.filters"
      class="mt-4"
      @apply="emit('applyFilters')"
      @reset="emit('resetFilters')"
    >
      <slot name="filters" />
    </FilterPanel>
  </div>
</template>
