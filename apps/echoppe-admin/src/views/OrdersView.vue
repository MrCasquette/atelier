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
import FilterNumberRange from '@/components/molecules/PageHeader/FilterNumberRange.vue';
import type { DataTableColumn } from '@/components/organisms/DataTable/types';
import type { BatchAction, FilterOption } from '@/components/molecules/PageHeader/types';
import type { StatusVariant } from '@/types/ui';
import type { ApiData } from '@/types/api';

// Types inférés depuis Eden
type OrdersResponse = ApiData<ReturnType<typeof api.orders.get>>;
type Order = OrdersResponse['data'][number];

const DEFAULT_LIMIT = 20;

const router = useRouter();
const route = useRoute();
const toast = useToast();

const orders = ref<Order[]>([]);
const loading = ref(true);
const selectedOrders = ref<Order[]>([]);

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
const amountMinFilter = ref('');
const amountMaxFilter = ref('');
const filtersOpen = ref(false);

// Tri serveur (id de colonne + sens). Vide = tri par défaut de l'API (date desc).
const sortField = ref('');
const sortOrder = ref<'asc' | 'desc'>('desc');

const statusOptions: FilterOption[] = [
  { value: 'pending', label: 'En attente' },
  { value: 'confirmed', label: 'Confirmee' },
  { value: 'processing', label: 'En traitement' },
  { value: 'shipped', label: 'Expediee' },
  { value: 'delivered', label: 'Livree' },
  { value: 'cancelled', label: 'Annulee' },
  { value: 'refunded', label: 'Remboursee' },
];

async function loadOrders() {
  loading.value = true;
  try {
    const query: Record<string, string | number> = {
      page: paginationMeta.value.page,
      limit: paginationMeta.value.limit,
    };

    if (searchFilter.value) query.search = searchFilter.value;
    if (statusFilter.value) query.status = statusFilter.value;
    if (dateFromFilter.value) query.dateFrom = dateFromFilter.value;
    if (dateToFilter.value) query.dateTo = dateToFilter.value;
    if (amountMinFilter.value) query.amountMin = parseFloat(amountMinFilter.value);
    if (amountMaxFilter.value) query.amountMax = parseFloat(amountMaxFilter.value);
    if (sortField.value) {
      query.sort = sortField.value;
      query.order = sortOrder.value;
    }

    const { data } = await api.orders.get({ query });
    if (data?.data && data?.meta) {
      orders.value = data.data;
      paginationMeta.value = data.meta;
    }
  } catch {
    toast.error('Erreur lors du chargement des commandes');
  } finally {
    loading.value = false;
  }
}

function handleSort(payload: { field: string; order: 'asc' | 'desc' } | null) {
  sortField.value = payload?.field ?? '';
  sortOrder.value = payload?.order ?? 'desc';
  paginationMeta.value.page = 1;
  loadOrders();
}

function setPage(page: number) {
  paginationMeta.value.page = page;
  router.replace({ query: { ...route.query, page: page > 1 ? String(page) : undefined } });
  loadOrders();
}

function applyFilters() {
  paginationMeta.value.page = 1;
  loadOrders();
}

function resetFilters() {
  searchFilter.value = '';
  statusFilter.value = '';
  dateFromFilter.value = '';
  dateToFilter.value = '';
  amountMinFilter.value = '';
  amountMaxFilter.value = '';
  paginationMeta.value.page = 1;
  loadOrders();
}

onMounted(loadOrders);

function openDetail(order: Order) {
  router.push(`/commandes/${order.id}`);
}

function getStatusConfig(status: string): { label: string; variant: StatusVariant } {
  const config: Record<string, { label: string; variant: StatusVariant }> = {
    pending: { label: 'En attente', variant: 'warning' },
    confirmed: { label: 'Confirmée', variant: 'success' },
    processing: { label: 'En traitement', variant: 'info' },
    shipped: { label: 'Expédiée', variant: 'success' },
    delivered: { label: 'Livrée', variant: 'success' },
    cancelled: { label: 'Annulée', variant: 'default' },
    refunded: { label: 'Remboursée', variant: 'error' },
  };
  return config[status] || { label: status, variant: 'default' };
}

function formatDate(date: Date | string | null) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function formatPrice(amount: string | number) {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

// Column definitions for DataTable
const columns = computed<DataTableColumn<Order>[]>(() => [
  {
    id: 'orderNumber',
    label: 'N° Commande',
    accessorKey: 'orderNumber',
    cell: ({ row }) =>
      h('span', { class: 'font-mono font-medium text-gray-900' }, row.original.orderNumber),
  },
  {
    id: 'customer',
    label: 'Client',
    accessorKey: 'customer',
    sortable: false,
    cell: ({ row }) =>
      h('div', {}, [
        h(
          'p',
          { class: 'font-medium text-gray-900' },
          `${row.original.customer.firstName} ${row.original.customer.lastName}`,
        ),
        h('p', { class: 'text-sm text-gray-500' }, row.original.customer.email),
      ]),
  },
  {
    id: 'status',
    label: 'Statut',
    accessorKey: 'status',
    cell: ({ row }) => {
      const config = getStatusConfig(row.original.status);
      return h(Badge, { variant: config.variant }, () => config.label);
    },
  },
  {
    id: 'totalTtc',
    label: 'Total',
    accessorKey: 'totalTtc',
    cell: ({ row }) =>
      h('span', { class: 'font-medium text-gray-900' }, formatPrice(row.original.totalTtc)),
  },
  {
    id: 'dateCreated',
    label: 'Date',
    accessorKey: 'dateCreated',
    cell: ({ row }) =>
      h('span', { class: 'text-gray-500 text-sm' }, formatDate(row.original.dateCreated)),
  },
]);

// Batch actions
const batchActions: BatchAction[] = [
  { id: 'processing', label: 'En traitement', icon: 'edit' },
  { id: 'shipped', label: 'Expédiée', icon: 'archive' },
  { id: 'cancelled', label: 'Annuler', icon: 'trash', variant: 'danger' },
];

function handleSelectionChange(selected: Order[]) {
  selectedOrders.value = selected;
}

async function setOrdersStatus(status: 'processing' | 'shipped' | 'cancelled') {
  try {
    let failed = 0;
    for (const o of selectedOrders.value) {
      const { error } = await api.orders({ id: o.id }).status.patch({ status });
      if (error) failed++;
    }
    selectedOrders.value = [];
    await loadOrders();
    if (failed > 0) toast.error(`Échec de la mise à jour de ${failed} commande(s)`);
    else toast.success('Commande(s) mise(s) à jour');
  } catch {
    toast.error('Erreur lors de la mise à jour');
  }
}

function handleBatchAction(actionId: string) {
  if (actionId === 'processing') {
    setOrdersStatus('processing');
  } else if (actionId === 'shipped') {
    setOrdersStatus('shipped');
  } else if (actionId === 'cancelled') {
    setOrdersStatus('cancelled');
  }
}

const activeFiltersCount = computed(() => {
  let count = 0;
  if (searchFilter.value) count++;
  if (statusFilter.value) count++;
  if (dateFromFilter.value || dateToFilter.value) count++;
  if (amountMinFilter.value || amountMaxFilter.value) count++;
  return count;
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">
        Commandes
      </h1>
    </div>

    <DataTable
      v-model:filters-open="filtersOpen"
      :data="orders"
      :columns="columns"
      :loading="loading"
      :batch-actions="batchActions"
      :on-batch-action="handleBatchAction"
      :show-add="false"
      :searchable="false"
      filterable
      server-sort
      :active-filters-count="activeFiltersCount"
      empty-message="Aucune commande"
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
          placeholder="N° commande, client, email..."
        />
        <FilterSelect
          v-model="statusFilter"
          label="Statut"
          :options="statusOptions"
        />
        <FilterDateRange
          v-model:from-value="dateFromFilter"
          v-model:to-value="dateToFilter"
          label="Periode"
        />
        <FilterNumberRange
          v-model:min-value="amountMinFilter"
          v-model:max-value="amountMaxFilter"
          label="Montant"
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
