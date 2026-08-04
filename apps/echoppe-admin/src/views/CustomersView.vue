<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '@/lib/api';
import { useToast } from '@/composables/useToast';
import Badge from '@/components/atoms/Badge.vue';
import DataTable from '@/components/organisms/DataTable/DataTable.vue';
import Pagination from '@/components/molecules/Pagination.vue';
import FilterText from '@/components/molecules/PageHeader/FilterText.vue';
import FilterSelect from '@/components/molecules/PageHeader/FilterSelect.vue';
import FilterDateRange from '@/components/molecules/PageHeader/FilterDateRange.vue';
import type { DataTableColumn } from '@/components/organisms/DataTable/types';
import type { BatchAction, FilterOption } from '@/components/molecules/PageHeader/types';
import type { StatusVariant } from '@/types/ui';
import type { ApiData } from '@/types/api';

// Types inférés depuis Eden
type CustomersResponse = ApiData<ReturnType<typeof api.customers.get>>;
type Customer = CustomersResponse['data'][number];

const DEFAULT_LIMIT = 20;

const router = useRouter();
const route = useRoute();
const toast = useToast();

const customers = ref<Customer[]>([]);
const loading = ref(true);
const selectedCustomers = ref<Customer[]>([]);

// Pagination state
const paginationMeta = ref({
  total: 0,
  page: 1,
  limit: DEFAULT_LIMIT,
  totalPages: 0,
});

// Filters
const searchFilter = ref('');
const statusFilter = ref('');
const dateFromFilter = ref('');
const dateToFilter = ref('');
const hasOrdersFilter = ref('');
const filtersOpen = ref(false);

// Tri serveur. Les id de colonnes correspondent aux clés d'allowlist de l'API.
const sortField = ref('');
const sortOrder = ref<'asc' | 'desc'>('desc');

const statusOptions: FilterOption[] = [
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
];

const hasOrdersOptions: FilterOption[] = [
  { value: 'true', label: 'Avec commandes' },
  { value: 'false', label: 'Sans commandes' },
];

async function loadCustomers() {
  loading.value = true;
  try {
    const query: Record<string, string | number | boolean> = {
      page: paginationMeta.value.page,
      limit: paginationMeta.value.limit,
    };

    if (searchFilter.value) query.search = searchFilter.value;
    if (statusFilter.value) query.status = statusFilter.value;
    if (dateFromFilter.value) query.dateFrom = dateFromFilter.value;
    if (dateToFilter.value) query.dateTo = dateToFilter.value;
    if (hasOrdersFilter.value) query.hasOrders = hasOrdersFilter.value;
    if (sortField.value) {
      query.sort = sortField.value;
      query.order = sortOrder.value;
    }

    const { data } = await api.customers.get({ query });
    if (data?.data && data?.meta) {
      customers.value = data.data;
      paginationMeta.value = data.meta;
    }
  } catch {
    toast.error('Erreur lors du chargement des clients');
  } finally {
    loading.value = false;
  }
}

function handleSort(payload: { field: string; order: 'asc' | 'desc' } | null) {
  sortField.value = payload?.field ?? '';
  sortOrder.value = payload?.order ?? 'desc';
  paginationMeta.value.page = 1;
  loadCustomers();
}

function setPage(page: number) {
  paginationMeta.value.page = page;
  router.replace({ query: { ...route.query, page: page > 1 ? String(page) : undefined } });
  loadCustomers();
}

function applyFilters() {
  paginationMeta.value.page = 1;
  loadCustomers();
}

function resetFilters() {
  searchFilter.value = '';
  statusFilter.value = '';
  dateFromFilter.value = '';
  dateToFilter.value = '';
  hasOrdersFilter.value = '';
  paginationMeta.value.page = 1;
  loadCustomers();
}

onMounted(loadCustomers);

function openDetail(customer: Customer) {
  router.push(`/clients/${customer.id}`);
}

function formatDate(date: Date | string | null) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

function formatDateTime(date: Date | string | null) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function getStatusConfig(emailVerified: boolean): { label: string; variant: StatusVariant } {
  return emailVerified
    ? { label: 'Actif', variant: 'success' }
    : { label: 'Inactif', variant: 'default' };
}

// Column definitions for DataTable
const columns = computed<DataTableColumn<Customer>[]>(() => [
  {
    id: 'name',
    label: 'Client',
    accessorKey: 'firstName',
    cell: ({ row }) =>
      h('div', {}, [
        h(
          'p',
          { class: 'font-medium text-gray-900' },
          `${row.original.firstName} ${row.original.lastName}`,
        ),
        h('p', { class: 'text-sm text-gray-500' }, row.original.email),
      ]),
  },
  {
    id: 'phone',
    label: 'Téléphone',
    accessorKey: 'phone',
    sortable: false,
    cell: ({ row }) =>
      h('span', { class: 'text-gray-600' }, row.original.phone || '-'),
  },
  {
    id: 'status',
    label: 'Statut',
    accessorKey: 'emailVerified',
    sortable: false,
    cell: ({ row }) => {
      const config = getStatusConfig(row.original.emailVerified);
      return h(Badge, { variant: config.variant }, () => config.label);
    },
  },
  {
    id: 'orderCount',
    label: 'Commandes',
    accessorKey: 'orderCount',
    sortable: false,
    cell: ({ row }) =>
      h('span', { class: 'text-gray-600' }, String(row.original.orderCount)),
  },
  {
    id: 'dateCreated',
    label: 'Inscription',
    accessorKey: 'dateCreated',
    cell: ({ row }) =>
      h('span', { class: 'text-gray-500 text-sm' }, formatDate(row.original.dateCreated)),
  },
  {
    id: 'lastLogin',
    label: 'Dernière connexion',
    accessorKey: 'lastLogin',
    cell: ({ row }) =>
      h('span', { class: 'text-gray-500 text-sm' }, formatDateTime(row.original.lastLogin)),
  },
]);

// Batch actions
const batchActions: BatchAction[] = [
  { id: 'activate', label: 'Activer', icon: 'edit' },
  { id: 'deactivate', label: 'Désactiver', icon: 'archive', variant: 'danger' },
];

function handleSelectionChange(selected: Customer[]) {
  selectedCustomers.value = selected;
}

async function setCustomersStatus(isActive: boolean) {
  try {
    let failed = 0;
    for (const c of selectedCustomers.value) {
      const { error } = await api.customers({ id: c.id }).status.patch({ isActive });
      if (error) failed++;
    }
    selectedCustomers.value = [];
    await loadCustomers();
    if (failed > 0) toast.error(`Échec de la mise à jour de ${failed} client(s)`);
    else toast.success('Client(s) mis à jour');
  } catch {
    toast.error('Erreur lors de la mise à jour');
  }
}

function handleBatchAction(actionId: string) {
  if (actionId === 'activate') {
    setCustomersStatus(true);
  } else if (actionId === 'deactivate') {
    setCustomersStatus(false);
  }
}

const activeFiltersCount = computed(() => {
  let count = 0;
  if (searchFilter.value) count++;
  if (statusFilter.value) count++;
  if (dateFromFilter.value || dateToFilter.value) count++;
  if (hasOrdersFilter.value) count++;
  return count;
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">
        Clients
      </h1>
    </div>

    <DataTable
      v-model:filters-open="filtersOpen"
      :data="customers"
      :columns="columns"
      :loading="loading"
      :batch-actions="batchActions"
      :on-batch-action="handleBatchAction"
      :show-add="false"
      :searchable="false"
      filterable
      server-sort
      :active-filters-count="activeFiltersCount"
      empty-message="Aucun client"
      :on-row-click="openDetail"
      @selection-change="handleSelectionChange"
      @apply-filters="applyFilters"
      @reset-filters="resetFilters"
      @sort="handleSort"
    >
      <template #filters>
        <FilterText
          v-model="searchFilter"
          label="Recherche"
          placeholder="Email, nom, prénom..."
        />
        <FilterSelect
          v-model="statusFilter"
          label="Statut"
          :options="statusOptions"
        />
        <FilterDateRange
          v-model:from-value="dateFromFilter"
          v-model:to-value="dateToFilter"
          label="Inscription"
        />
        <FilterSelect
          v-model="hasOrdersFilter"
          label="Commandes"
          :options="hasOrdersOptions"
        />
      </template>
    </DataTable>

    <Pagination
      v-if="paginationMeta.totalPages > 1"
      :page="paginationMeta.page"
      :total-pages="paginationMeta.totalPages"
      :total="paginationMeta.total"
      :limit="paginationMeta.limit"
      @update:page="setPage"
    />
  </div>
</template>
