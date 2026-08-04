<script setup lang="ts" generic="TData extends Record<string, unknown>">
import { ref, computed, watch, onBeforeUnmount, h } from 'vue';
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  FlexRender,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
  type ColumnDef,
} from '@tanstack/vue-table';
import Checkbox from '@/components/atoms/Checkbox.vue';
import SpinnerIcon from '@/components/atoms/icons/SpinnerIcon.vue';
import ChevronUpIcon from '@/components/atoms/icons/ChevronUpIcon.vue';
import ChevronDownIcon from '@/components/atoms/icons/ChevronDownIcon.vue';
import SortIcon from '@/components/atoms/icons/SortIcon.vue';
import GripIcon from '@/components/atoms/icons/GripIcon.vue';
import { useSortable, type FlatDropPosition } from '@/composables/sortable';
import type { DataTableColumn } from './types';
import PageHeader from '@/components/molecules/PageHeader/PageHeader.vue';
import type { BatchAction, ColumnInfo } from '@/components/molecules/PageHeader/types';

const props = withDefaults(
  defineProps<{
    data: TData[];
    columns: DataTableColumn<TData>[];
    loading?: boolean;
    searchable?: boolean;
    searchPlaceholder?: string;
    serverSearch?: boolean;
    serverSort?: boolean;
    searchDebounce?: number;
    filterable?: boolean;
    filtersOpen?: boolean;
    activeFiltersCount?: number;
    selectable?: boolean;
    onRowClick?: (_row: TData) => void;
    addLabel?: string;
    emptyMessage?: string;
    showAdd?: boolean;
    batchActions?: BatchAction[];
    onBatchAction?: (_actionId: string) => void;
    reorderable?: boolean;
    rowId?: (_row: TData) => string;
    onReorder?: (_draggedId: string, _targetId: string, _position: FlatDropPosition) => void;
  }>(),
  {
    loading: false,
    searchable: true,
    searchPlaceholder: 'Rechercher...',
    serverSearch: false,
    serverSort: false,
    searchDebounce: 300,
    filterable: false,
    filtersOpen: false,
    activeFiltersCount: 0,
    selectable: true,
    onRowClick: undefined,
    addLabel: 'Ajouter',
    emptyMessage: 'Aucun element',
    showAdd: true,
    batchActions: () => [],
    onBatchAction: undefined,
    reorderable: false,
    rowId: undefined,
    onReorder: undefined,
  }
);

const emit = defineEmits<{
  add: [];
  selectionChange: [selectedRows: TData[]];
  'update:filtersOpen': [open: boolean];
  applyFilters: [];
  resetFilters: [];
  search: [value: string];
  sort: [payload: { field: string; order: 'asc' | 'desc' } | null];
}>();

const sorting = ref<SortingState>([]);
const globalFilter = ref('');
const columnVisibility = ref<VisibilityState>({});
const rowSelection = ref<RowSelectionState>({});
const columnOrder = ref<string[]>([]);

// Initialize column order from props
watch(
  () => props.columns,
  (cols) => {
    if (columnOrder.value.length === 0) {
      columnOrder.value = cols.map((c) => c.id);
    }
  },
  { immediate: true }
);

// Initialize visibility from columns defaultVisible
watch(
  () => props.columns,
  (cols) => {
    const visibility: VisibilityState = {};
    for (const col of cols) {
      if (col.defaultVisible === false) {
        visibility[col.id] = false;
      }
    }
    columnVisibility.value = visibility;
  },
  { immediate: true, once: true }
);

// Drag & drop sortable
function getRowId(row: TData): string {
  if (props.rowId) return props.rowId(row);
  return (row as Record<string, unknown>).id as string;
}

function handleReorder(draggedId: string, targetId: string, position: FlatDropPosition) {
  props.onReorder?.(draggedId, targetId, position);
}

const sortable = useSortable({
  dropZoneAttr: 'data-datatable-drop',
  onReorder: handleReorder,
});

// Drag is only enabled when sorting by _reorder column or no sorting
const isDragEnabled = computed(() => {
  if (!props.reorderable) return false;
  // Drag enabled if no sorting or sorting by _reorder
  return sorting.value.length === 0 || sorting.value[0]?.id === '_reorder';
});

const tableColumns = computed<ColumnDef<TData, unknown>[]>(() => {
  const cols: ColumnDef<TData, unknown>[] = [];

  // Reorder column (grip icon when drag enabled, order number otherwise)
  if (props.reorderable) {
    cols.push({
      id: '_reorder',
      header: '',
      accessorKey: '_reorder',
      cell: ({ row }) =>
        isDragEnabled.value
          ? h('div', { class: 'cursor-grab text-gray-400 hover:text-gray-600' }, [h(GripIcon)])
          : h('span', { class: 'text-gray-400 text-sm' }, String(row.index + 1)),
      size: 44,
      enableSorting: true,
      enableHiding: false,
    });
  }

  // Selection column
  if (props.selectable) {
    cols.push({
      id: '_select',
      header: ({ table }) =>
        h(Checkbox, {
          checked: table.getIsAllRowsSelected(),
          onClick: () => table.toggleAllRowsSelected(),
        }),
      cell: ({ row }) =>
        h(Checkbox, {
          checked: row.getIsSelected(),
          onClick: () => row.toggleSelected(),
        }),
      size: 40,
      enableSorting: false,
      enableHiding: false,
    });
  }

  // User-defined columns
  for (const col of props.columns) {
    cols.push({
      id: col.id,
      accessorKey: col.accessorKey ?? col.id,
      header: col.label,
      cell: col.cell,
      enableSorting: col.sortable !== false,
      enableHiding: col.hideable !== false,
      size: col.size,
      minSize: col.minSize,
      maxSize: col.maxSize,
    } as ColumnDef<TData, unknown>);
  }

  return cols;
});

const table = useVueTable({
  get data() {
    return props.data;
  },
  get columns() {
    return tableColumns.value;
  },
  state: {
    get sorting() {
      return sorting.value;
    },
    get globalFilter() {
      // En mode recherche serveur, on n'applique pas le filtre client :
      // les données reçues sont déjà filtrées par l'API.
      return props.serverSearch ? '' : globalFilter.value;
    },
    get columnVisibility() {
      return columnVisibility.value;
    },
    get rowSelection() {
      return rowSelection.value;
    },
    get columnOrder() {
      const order = [...columnOrder.value];
      if (props.selectable) order.unshift('_select');
      if (props.reorderable) order.unshift('_reorder');
      return order;
    },
  },
  onSortingChange: (updater) => {
    sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater;
  },
  onGlobalFilterChange: (updater) => {
    globalFilter.value = typeof updater === 'function' ? updater(globalFilter.value) : updater;
  },
  onColumnVisibilityChange: (updater) => {
    columnVisibility.value =
      typeof updater === 'function' ? updater(columnVisibility.value) : updater;
  },
  onRowSelectionChange: (updater) => {
    rowSelection.value = typeof updater === 'function' ? updater(rowSelection.value) : updater;
  },
  // Tri serveur : TanStack ne trie pas côté client, il ne fait que porter l'état.
  manualSorting: props.serverSort,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  enableRowSelection: props.selectable,
  enableMultiRowSelection: true,
});

// Recherche serveur : émet la valeur saisie (debounce) au parent, qui relance l'API.
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(globalFilter, (value) => {
  if (!props.serverSearch) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => emit('search', value), props.searchDebounce);
});
onBeforeUnmount(() => clearTimeout(searchTimer));

// Tri serveur : émet la colonne triée (id + sens) au parent, qui relance l'API.
// `null` quand le tri est réinitialisé (retour au tri par défaut serveur).
watch(sorting, (value) => {
  if (!props.serverSort) return;
  const first = value[0];
  emit('sort', first ? { field: first.id, order: first.desc ? 'desc' : 'asc' } : null);
});

// Emit selection changes
watch(rowSelection, () => {
  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  emit('selectionChange', selectedRows);
});

// Column info for PageHeader ColumnsPopover
const columnInfoList = computed<ColumnInfo[]>(() => {
  return props.columns
    .filter((col) => col.hideable !== false)
    .map((col) => ({
      id: col.id,
      label: col.label,
      visible: columnVisibility.value[col.id] !== false,
    }));
});

// Get current sort state for a column
function getColumnSort(columnId: string): 'asc' | 'desc' | false {
  const sort = sorting.value.find((s) => s.id === columnId);
  if (!sort) return false;
  return sort.desc ? 'desc' : 'asc';
}

// Toggle sort: none -> asc -> desc -> none
function handleToggleSort(columnId: string) {
  const currentSort = getColumnSort(columnId);
  if (currentSort === false) {
    sorting.value = [{ id: columnId, desc: false }];
  } else if (currentSort === 'asc') {
    sorting.value = [{ id: columnId, desc: true }];
  } else {
    sorting.value = [];
  }
}

// Toggle column visibility
function handleToggleColumn(columnId: string) {
  const isCurrentlyVisible = columnVisibility.value[columnId] !== false;
  if (isCurrentlyVisible) {
    columnVisibility.value = { ...columnVisibility.value, [columnId]: false };
  } else {
    const { [columnId]: _removed, ...rest } = columnVisibility.value;
    void _removed;
    columnVisibility.value = rest;
  }
}

// Handle row click (disabled when drag is enabled)
function handleRowClick(row: TData) {
  if (isDragEnabled.value) return;
  props.onRowClick?.(row);
}

// Get visible headers (excluding _select)
const visibleHeaders = computed(() => {
  return table
    .getHeaderGroups()[0]
    .headers.filter((h) => h.id !== '_select' && h.column.getIsVisible());
});

// Clear selection
function clearSelection() {
  rowSelection.value = {};
}

// Handle batch action
function handleBatchAction(actionId: string) {
  props.onBatchAction?.(actionId);
}
</script>

<template>
  <div class="w-full">
    <PageHeader
      :search-value="globalFilter"
      :total-items="data.length"
      :selected-count="Object.keys(rowSelection).length"
      :searchable="searchable"
      :search-placeholder="searchPlaceholder"
      :filterable="filterable"
      :filters-open="filtersOpen"
      :active-filters-count="activeFiltersCount"
      :show-add="showAdd"
      :add-label="addLabel"
      :batch-actions="batchActions"
      :columns="columnInfoList"
      @update:search-value="globalFilter = $event"
      @update:filters-open="emit('update:filtersOpen', $event)"
      @add="emit('add')"
      @batch-action="handleBatchAction"
      @clear-selection="clearSelection"
      @apply-filters="emit('applyFilters')"
      @reset-filters="emit('resetFilters')"
      @toggle-column="handleToggleColumn"
    >
      <template
        v-if="$slots.filters"
        #filters
      >
        <slot name="filters" />
      </template>
      <template
        v-if="$slots.actions"
        #actions
      >
        <slot name="actions" />
      </template>
    </PageHeader>

    <div class="bg-white rounded-lg shadow overflow-visible">
      <div
        v-if="loading"
        class="p-8 text-center text-gray-500"
      >
        <SpinnerIcon
          size="lg"
          class="mx-auto text-blue-600"
        />
        <p class="mt-2">
          Chargement...
        </p>
      </div>

      <div
        v-else-if="table.getRowModel().rows.length === 0"
        class="p-8 text-center text-gray-500"
      >
        {{ emptyMessage }}
      </div>

      <table
        v-else
        class="w-full"
      >
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <!-- Selection header -->
            <th
              v-if="selectable"
              class="w-10 px-3 py-3"
            >
              <FlexRender
                :render="table.getHeaderGroups()[0].headers.find(h => h.id === '_select')?.column.columnDef.header"
                :props="table.getHeaderGroups()[0].headers.find(h => h.id === '_select')?.getContext()"
              />
            </th>

            <!-- Column headers -->
            <th
              v-for="header in visibleHeaders"
              :key="header.id"
              class="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider group select-none"
              :class="[
                header.column.getCanSort()
                  ? 'cursor-pointer hover:bg-gray-100 transition-colors'
                  : '',
                getColumnSort(header.id) ? 'text-blue-600 bg-blue-50/50' : 'text-gray-500'
              ]"
              :style="{ width: header.getSize() !== 150 ? `${header.getSize()}px` : undefined }"
              @click="header.column.getCanSort() && handleToggleSort(header.id)"
            >
              <div class="flex items-center gap-2">
                <span class="flex-1">
                  <FlexRender
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                </span>

                <!-- Sort indicator - always visible when sorted -->
                <span
                  v-if="getColumnSort(header.id)"
                  class="text-blue-600"
                >
                  <ChevronUpIcon
                    v-if="getColumnSort(header.id) === 'asc'"
                    size="sm"
                  />
                  <ChevronDownIcon
                    v-else
                    size="sm"
                  />
                </span>

                <!-- Sort hint on hover (when not sorted) -->
                <span
                  v-else-if="header.column.getCanSort()"
                  class="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <SortIcon size="sm" />
                </span>
              </div>
            </th>
          </tr>
        </thead>

        <tbody
          class="divide-y divide-gray-200"
          :data-datatable-drop="isDragEnabled || undefined"
        >
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            class="hover:bg-gray-50 transition-colors relative"
            :class="[
              { 'cursor-pointer': !!onRowClick && !isDragEnabled },
              isDragEnabled && sortable.isItemDragging(getRowId(row.original)) && 'opacity-40 bg-blue-50',
            ]"
            :draggable="isDragEnabled"
            :data-datatable-drop="isDragEnabled || undefined"
            @click="handleRowClick(row.original)"
            @dragstart="isDragEnabled && sortable.handleDragStart($event, getRowId(row.original))"
            @dragover="isDragEnabled && sortable.handleDragOver($event, getRowId(row.original))"
            @dragleave="isDragEnabled && sortable.handleDragLeave($event)"
            @drop="isDragEnabled && sortable.handleDrop($event, getRowId(row.original))"
            @dragend="isDragEnabled && sortable.handleDragEnd()"
          >
            <!-- Drop indicator line - before -->
            <td
              v-if="isDragEnabled && sortable.isDropTarget(getRowId(row.original)) && sortable.getItemDropPosition(getRowId(row.original)) === 'before'"
              :colspan="row.getVisibleCells().length"
              class="absolute inset-x-0 top-0 h-0 p-0 border-none"
            >
              <div class="h-0.5 bg-blue-500 rounded-full mx-2" />
            </td>
            <!-- Drop indicator line - after -->
            <td
              v-if="isDragEnabled && sortable.isDropTarget(getRowId(row.original)) && sortable.getItemDropPosition(getRowId(row.original)) === 'after'"
              :colspan="row.getVisibleCells().length"
              class="absolute inset-x-0 bottom-0 h-0 p-0 border-none"
            >
              <div class="h-0.5 bg-blue-500 rounded-full mx-2" />
            </td>

            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="px-4 py-3 text-sm"
              :class="{
                'w-10 px-3': cell.column.id === '_select',
                'w-10 pl-2 pr-0': cell.column.id === '_reorder',
              }"
              :data-datatable-drop="isDragEnabled && cell.column.id === '_reorder' || undefined"
            >
              <FlexRender
                :render="cell.column.columnDef.cell"
                :props="cell.getContext()"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
