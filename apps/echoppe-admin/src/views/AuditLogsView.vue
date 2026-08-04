<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '@/lib/api';
import {
  useAuditLogs,
  getActionBadgeStyle,
  formatAction,
  ENTITY_TYPE_LABELS,
} from '@/composables/audit';
import Badge from '@/components/atoms/Badge.vue';
import Modal from '@/components/atoms/Modal.vue';
import DataTable from '@/components/organisms/DataTable/DataTable.vue';
import Pagination from '@/components/molecules/Pagination.vue';
import FilterSelect from '@/components/molecules/PageHeader/FilterSelect.vue';
import FilterDateRange from '@/components/molecules/PageHeader/FilterDateRange.vue';
import type { DataTableColumn } from '@/components/organisms/DataTable/types';
import type { FilterOption } from '@/components/molecules/PageHeader/types';
import type { StatusVariant } from '@/types/ui';
import type { AuditLog } from '@/composables/audit';

// Types pour les utilisateurs (pour le filtre)
type UsersResponse = Awaited<ReturnType<typeof api.users.get>>['data'];
type UserItem = NonNullable<UsersResponse>['data'][number];

const router = useRouter();
const route = useRoute();

const {
  logs,
  meta,
  loading,
  filters,
  availableActions,
  availableEntityTypes,
  loadLogs,
  loadFilterOptions,
  setPage,
  clearFilters,
} = useAuditLogs();

// Users for filter dropdown
const users = ref<UserItem[]>([]);

// Local filter state (to sync with composable)
const actionFilter = ref('');
const entityTypeFilter = ref('');
const userFilter = ref('');
const dateFromFilter = ref('');
const dateToFilter = ref('');
const filtersOpen = ref(false);

// Detail modal
const showDetailModal = ref(false);
const selectedLog = ref<AuditLog | null>(null);

// Load users for filter
async function loadUsers() {
  const { data } = await api.users.get({ query: { limit: 100 } });
  if (data?.data) {
    users.value = data.data;
  }
}

// Filter options
const actionOptions = computed<FilterOption[]>(() =>
  availableActions.value.map((a) => ({ value: a, label: formatAction(a) })),
);

const entityTypeOptions = computed<FilterOption[]>(() =>
  availableEntityTypes.value.map((t) => ({
    value: t,
    label: ENTITY_TYPE_LABELS[t] ?? t,
  })),
);

const userOptions = computed<FilterOption[]>(() =>
  users.value.map((u) => ({
    value: u.id,
    label: `${u.firstName} ${u.lastName}`,
  })),
);

function applyFilters() {
  filters.action = actionFilter.value || undefined;
  filters.entityType = entityTypeFilter.value || undefined;
  filters.userId = userFilter.value || undefined;
  filters.dateFrom = dateFromFilter.value || undefined;
  filters.dateTo = dateToFilter.value || undefined;
  loadLogs(1, meta.value.limit);
}

function resetFilters() {
  actionFilter.value = '';
  entityTypeFilter.value = '';
  userFilter.value = '';
  dateFromFilter.value = '';
  dateToFilter.value = '';
  clearFilters();
}

function handlePageChange(page: number) {
  router.replace({ query: { ...route.query, page: page > 1 ? String(page) : undefined } });
  setPage(page);
}

function openDetail(log: AuditLog) {
  selectedLog.value = log;
  showDetailModal.value = true;
}

function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(date));
}

function getBadgeVariant(action: string): StatusVariant {
  const style = getActionBadgeStyle(action);
  const variantMap: Record<string, StatusVariant> = {
    green: 'success',
    blue: 'info',
    red: 'error',
    purple: 'info',
    orange: 'warning',
    gray: 'default',
    cyan: 'info',
    yellow: 'warning',
    pink: 'error',
  };
  return variantMap[style.color] ?? 'default';
}

// Column definitions
const columns = computed<DataTableColumn<AuditLog>[]>(() => [
  {
    id: 'dateCreated',
    label: 'Date',
    accessorKey: 'dateCreated',
    cell: ({ row }) =>
      h('span', { class: 'text-sm text-gray-600' }, formatDateTime(row.original.dateCreated)),
  },
  {
    id: 'user',
    label: 'Utilisateur',
    accessorKey: 'user',
    cell: ({ row }) => {
      const u = row.original.user;
      if (!u) {
        return h('span', { class: 'text-gray-400 italic' }, 'Système');
      }
      return h('div', {}, [
        h('p', { class: 'font-medium text-gray-900' }, `${u.firstName} ${u.lastName}`),
        h('p', { class: 'text-sm text-gray-500' }, u.email),
      ]);
    },
  },
  {
    id: 'action',
    label: 'Action',
    accessorKey: 'action',
    cell: ({ row }) => {
      const action = row.original.action;
      return h(
        Badge,
        { variant: getBadgeVariant(action), size: 'sm' },
        () => formatAction(action),
      );
    },
  },
  {
    id: 'entityType',
    label: 'Type',
    accessorKey: 'entityType',
    cell: ({ row }) => {
      const type = row.original.entityType;
      if (!type) return h('span', { class: 'text-gray-400' }, '-');
      return h('span', { class: 'text-gray-700' }, ENTITY_TYPE_LABELS[type] ?? type);
    },
  },
  {
    id: 'entityId',
    label: 'ID Entité',
    accessorKey: 'entityId',
    cell: ({ row }) => {
      const id = row.original.entityId;
      if (!id) return h('span', { class: 'text-gray-400' }, '-');
      return h(
        'code',
        { class: 'text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono' },
        id.substring(0, 8) + '...',
      );
    },
  },
  {
    id: 'ipAddress',
    label: 'IP',
    accessorKey: 'ipAddress',
    cell: ({ row }) => {
      const ip = row.original.ipAddress;
      if (!ip) return h('span', { class: 'text-gray-400' }, '-');
      return h('code', { class: 'text-xs text-gray-600 font-mono' }, ip);
    },
  },
]);

const activeFiltersCount = computed(() => {
  let count = 0;
  if (actionFilter.value) count++;
  if (entityTypeFilter.value) count++;
  if (userFilter.value) count++;
  if (dateFromFilter.value || dateToFilter.value) count++;
  return count;
});

onMounted(async () => {
  // Init from URL
  if (route.query.page) {
    const urlPage = parseInt(route.query.page as string, 10);
    if (!isNaN(urlPage) && urlPage > 0) {
      meta.value.page = urlPage;
    }
  }

  await Promise.all([loadLogs(), loadFilterOptions(), loadUsers()]);
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          Journal d'audit
        </h1>
        <p class="text-gray-500 mt-1">
          Historique des actions effectuées sur la plateforme
        </p>
      </div>
    </div>

    <DataTable
      v-model:filters-open="filtersOpen"
      :data="logs"
      :columns="columns"
      :loading="loading"
      :show-add="false"
      :searchable="false"
      :selectable="false"
      filterable
      :active-filters-count="activeFiltersCount"
      empty-message="Aucune entrée dans le journal"
      :on-row-click="openDetail"
      @apply-filters="applyFilters"
      @reset-filters="resetFilters"
    >
      <template #filters>
        <FilterSelect
          v-model="actionFilter"
          label="Action"
          :options="actionOptions"
        />
        <FilterSelect
          v-model="entityTypeFilter"
          label="Type d'entité"
          :options="entityTypeOptions"
        />
        <FilterSelect
          v-model="userFilter"
          label="Utilisateur"
          :options="userOptions"
        />
        <FilterDateRange
          :from-value="dateFromFilter"
          :to-value="dateToFilter"
          label="Période"
          from-placeholder="Du"
          to-placeholder="Au"
          @update:from-value="dateFromFilter = $event"
          @update:to-value="dateToFilter = $event"
        />
      </template>
    </DataTable>

    <Pagination
      v-if="meta.totalPages > 1"
      :page="meta.page"
      :total-pages="meta.totalPages"
      :total="meta.total"
      :limit="meta.limit"
      @update:page="handlePageChange"
    />

    <!-- Detail Modal -->
    <Modal
      v-if="showDetailModal"
      title="Détails de l'action"
      @close="showDetailModal = false"
    >
      <div
        v-if="selectedLog"
        class="space-y-4"
      >
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-500">Date</label>
            <p class="mt-1">
              {{ formatDateTime(selectedLog.dateCreated) }}
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-500">IP</label>
            <p class="mt-1 font-mono text-sm">
              {{ selectedLog.ipAddress ?? '-' }}
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-500">Utilisateur</label>
            <p
              v-if="selectedLog.user"
              class="mt-1"
            >
              {{ selectedLog.user.firstName }} {{ selectedLog.user.lastName }}
              <span class="text-gray-500">({{ selectedLog.user.email }})</span>
            </p>
            <p
              v-else
              class="mt-1 text-gray-400 italic"
            >
              Système
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-500">Action</label>
            <p class="mt-1">
              <Badge
                :variant="getBadgeVariant(selectedLog.action)"
                size="sm"
              >
                {{ formatAction(selectedLog.action) }}
              </Badge>
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-500">Type d'entité</label>
            <p class="mt-1">
              {{ selectedLog.entityType ? ENTITY_TYPE_LABELS[selectedLog.entityType] ?? selectedLog.entityType : '-' }}
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-500">ID Entité</label>
            <p class="mt-1 font-mono text-sm">
              {{ selectedLog.entityId ?? '-' }}
            </p>
          </div>
        </div>

        <div v-if="selectedLog.data">
          <label class="block text-sm font-medium text-gray-500 mb-2">Données</label>
          <pre class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm overflow-auto max-h-64 font-mono">{{ JSON.stringify(selectedLog.data, null, 2) }}</pre>
        </div>
      </div>
    </Modal>
  </div>
</template>
