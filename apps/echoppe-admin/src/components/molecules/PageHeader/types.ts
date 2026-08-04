export interface BatchAction {
  id: string;
  label: string;
  icon?: 'trash' | 'archive' | 'edit';
  variant?: 'default' | 'danger';
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface ColumnInfo {
  id: string;
  label: string;
  visible: boolean;
}
