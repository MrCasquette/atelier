import { ref, reactive } from 'vue';
import { api } from '@/lib/api';
import type { PaginationMeta } from '@/composables/usePagination';
import type { AuditLog, AuditFilters } from './types';

export function useAuditLogs() {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const logs = ref<AuditLog[]>([]);
  const meta = ref<PaginationMeta>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const loading = ref(false);
  const filters = reactive<AuditFilters>({});

  // Listes pour les filtres (dropdowns)
  const availableActions = ref<string[]>([]);
  const availableEntityTypes = ref<string[]>([]);

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------
  async function loadLogs(page = 1, limit = 50) {
    loading.value = true;

    const { data, error } = await api['audit-logs'].get({
      query: {
        page,
        limit,
        action: filters.action || undefined,
        entityType: filters.entityType || undefined,
        userId: filters.userId || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      },
    });

    if (!error && data) {
      logs.value = data.data;
      meta.value = data.meta;
    }

    loading.value = false;
  }

  async function loadAvailableActions() {
    const { data } = await api['audit-logs'].actions.get();
    if (data) {
      availableActions.value = data;
    }
  }

  async function loadAvailableEntityTypes() {
    const { data } = await api['audit-logs']['entity-types'].get();
    if (data) {
      availableEntityTypes.value = data;
    }
  }

  async function loadFilterOptions() {
    await Promise.all([loadAvailableActions(), loadAvailableEntityTypes()]);
  }

  // ---------------------------------------------------------------------------
  // ACTIONS
  // ---------------------------------------------------------------------------
  function setPage(page: number) {
    loadLogs(page, meta.value.limit);
  }

  function setFilters(newFilters: Partial<AuditFilters>) {
    Object.assign(filters, newFilters);
    loadLogs(1, meta.value.limit);
  }

  function clearFilters() {
    filters.action = undefined;
    filters.entityType = undefined;
    filters.userId = undefined;
    filters.dateFrom = undefined;
    filters.dateTo = undefined;
    loadLogs(1, meta.value.limit);
  }

  function refresh() {
    return loadLogs(meta.value.page, meta.value.limit);
  }

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------
  return {
    // State
    logs,
    meta,
    loading,
    filters,
    availableActions,
    availableEntityTypes,

    // API
    loadLogs,
    loadFilterOptions,

    // Actions
    setPage,
    setFilters,
    clearFilters,
    refresh,
  };
}
