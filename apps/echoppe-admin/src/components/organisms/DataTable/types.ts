import type { ColumnDef, SortingState, ColumnFiltersState, VisibilityState } from '@tanstack/vue-table';
import type { BadgeVariant } from '@/types/ui';

export type FilterOperator = 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte';

export interface FilterCondition {
  columnId: string;
  operator: FilterOperator;
  value: string | number | boolean;
}

export interface DataTableColumn<TData> extends Omit<ColumnDef<TData, unknown>, 'id'> {
  id: string;
  label: string;
  accessorKey?: string;
  sortable?: boolean;
  filterable?: boolean;
  hideable?: boolean;
  defaultVisible?: boolean;
}

export interface DataTableProps<TData> {
  data: TData[];
  columns: DataTableColumn<TData>[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  filterable?: boolean;
  selectable?: boolean;
  onRowClick?: (row: TData) => void;
  onAdd?: () => void;
  addLabel?: string;
  emptyMessage?: string;
}

export interface DataTableState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  columnOrder: string[];
  globalFilter: string;
  rowSelection: Record<string, boolean>;
}

export interface ColumnMenuAction {
  type: 'sort-asc' | 'sort-desc' | 'hide' | 'filter';
  columnId: string;
}

export interface BadgeConfig {
  label: string;
  variant: BadgeVariant;
}
