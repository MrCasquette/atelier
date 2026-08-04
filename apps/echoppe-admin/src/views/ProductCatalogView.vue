<script setup lang="ts">
import Badge from '@/components/atoms/Badge.vue';
import ConfirmModal from '@/components/atoms/ConfirmModal.vue';
import Thumbnail from '@/components/atoms/Thumbnail.vue';
import Pagination from '@/components/molecules/Pagination.vue';
import DataTable from '@/components/organisms/DataTable/DataTable.vue';
import type { BatchAction } from '@/components/molecules/PageHeader/types';
import type { DataTableColumn } from '@/components/organisms/DataTable/types';
import type { Category } from '@/composables/categories';
import { useToast } from '@/composables/useToast';
import { api } from '@/lib/api';
import type { ApiData } from '@/types/api';
import type { StatusVariant } from '@/types/ui';
import { computed, h, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// Types inférés depuis Eden
type ProductsResponse = ApiData<ReturnType<typeof api.products.admin.get>>;
type Product = ProductsResponse['data'][number];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7532';
const DEFAULT_LIMIT = 20;

const router = useRouter();
const route = useRoute();
const toast = useToast();

const products = ref<Product[]>([]);
const categories = ref<Category[]>([]);
const productThumbnails = ref<Map<string, string>>(new Map());
const loading = ref(true);
const deleteModalOpen = ref(false);
const selectedProducts = ref<Product[]>([]);
const searchFilter = ref('');

// Tri serveur. Les id de colonnes correspondent aux clés de tri de l'API.
const sortField = ref('');
const sortOrder = ref<'asc' | 'desc'>('desc');

// Pagination state
const paginationMeta = ref({
  total: 0,
  page: 1,
  limit: DEFAULT_LIMIT,
  totalPages: 0,
});

async function loadProducts() {
  loading.value = true;
  try {
    const query: Record<string, string | number> = {
      page: paginationMeta.value.page,
      limit: paginationMeta.value.limit,
    };
    if (searchFilter.value) query.search = searchFilter.value;
    if (sortField.value) {
      query.sort = sortField.value;
      query.order = sortOrder.value;
    }

    const { data } = await api.products.admin.get({ query });
    if (data?.data && data?.meta) {
      products.value = data.data;
      paginationMeta.value = data.meta;
      await loadProductThumbnails();
    }
  } catch {
    toast.error('Erreur lors du chargement des produits');
  } finally {
    loading.value = false;
  }
}

function setPage(page: number) {
  paginationMeta.value.page = page;
  router.replace({ query: { ...route.query, page: page > 1 ? String(page) : undefined } });
  loadProducts();
}

function onSearch(value: string) {
  searchFilter.value = value;
  // Une nouvelle recherche reconstruit la pagination depuis le premier résultat.
  paginationMeta.value.page = 1;
  router.replace({ query: { ...route.query, page: undefined } });
  loadProducts();
}

function handleSort(payload: { field: string; order: 'asc' | 'desc' } | null) {
  sortField.value = payload?.field ?? '';
  sortOrder.value = payload?.order ?? 'desc';
  paginationMeta.value.page = 1;
  loadProducts();
}

async function loadProductThumbnails() {
  if (!products.value?.length) return;

  const thumbnails = new Map<string, string>();

  await Promise.all(
    products.value.map(async (product) => {
      try {
        const { data: productMediaList } = await api.products({ id: product.id }).media.get();
        if (productMediaList) {
          const featured = productMediaList.find((pm) => pm.isFeatured);
          if (featured) {
            thumbnails.set(product.id, `${API_URL}/assets/${featured.media}`);
          }
        }
      } catch {
        // Ignore errors for individual products
      }
    }),
  );

  productThumbnails.value = thumbnails;
}

async function loadCategories() {
  const { data } = await api.categories.get();
  if (data) categories.value = data;
}

onMounted(async () => {
  await Promise.all([loadProducts(), loadCategories()]);
});

function openCreate() {
  router.push('/produits/new');
}

function openEdit(product: Product) {
  router.push(`/produits/${product.id}`);
}

function confirmDeleteSelected() {
  if (selectedProducts.value.length === 0) return;
  deleteModalOpen.value = true;
}

async function deleteSelectedProducts() {
  let failed = 0;
  for (const product of selectedProducts.value) {
    const { error } = await api.products({ id: product.id }).delete();
    if (error) failed++;
  }
  deleteModalOpen.value = false;
  selectedProducts.value = [];
  await loadProducts();
  if (failed > 0) toast.error(`Échec de la suppression de ${failed} produit(s)`);
}

function cancelDelete() {
  deleteModalOpen.value = false;
}

function getCategoryName(id: string) {
  return categories.value.find((c) => c.id === id)?.name || '-';
}

function getStatusConfig(status: string): { label: string; variant: StatusVariant } {
  switch (status) {
    case 'published':
      return { label: 'Publie', variant: 'success' };
    case 'draft':
      return { label: 'Brouillon', variant: 'warning' };
    case 'archived':
      return { label: 'Archive', variant: 'default' };
    default:
      return { label: status, variant: 'default' };
  }
}

function formatDate(date: Date | string | null) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

// Column definitions for DataTable
const columns = computed<DataTableColumn<Product>[]>(() => [
  {
    id: 'thumbnail',
    label: '',
    accessorKey: 'id',
    size: 64,
    sortable: false,
    hideable: false,
    cell: ({ row }) =>
      h(Thumbnail, {
        src: productThumbnails.value.get(row.original.id) || null,
        alt: row.original.name,
        size: 'lg',
      }),
  },
  {
    id: 'name',
    label: 'Nom',
    accessorKey: 'name',
    cell: ({ row }) =>
      h('div', {}, [
        h('p', { class: 'font-medium text-gray-900' }, row.original.name),
        h('p', { class: 'text-sm text-gray-500' }, row.original.slug),
      ]),
  },
  {
    id: 'category',
    label: 'Categorie',
    accessorKey: 'category',
    sortable: false,
    cell: ({ row }) => h('span', { class: 'text-gray-600' }, getCategoryName(row.original.category)),
  },
  {
    id: 'status',
    label: 'Statut',
    accessorKey: 'status',
    sortable: false,
    cell: ({ row }) => {
      const config = getStatusConfig(row.original.status);
      return h(Badge, { variant: config.variant }, () => config.label);
    },
  },
  {
    id: 'description',
    label: 'Description',
    accessorKey: 'description',
    defaultVisible: false,
    sortable: false,
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-gray-500 text-sm line-clamp-1 max-w-xs' },
        row.original.description || '-',
      ),
  },
  {
    id: 'dateCreated',
    label: 'Date creation',
    accessorKey: 'dateCreated',
    defaultVisible: false,
    cell: ({ row }) =>
      h('span', { class: 'text-gray-500 text-sm' }, formatDate(row.original.dateCreated)),
  },
  {
    id: 'dateUpdated',
    label: 'Derniere modif.',
    accessorKey: 'dateUpdated',
    defaultVisible: false,
    sortable: false,
    cell: ({ row }) =>
      h('span', { class: 'text-gray-500 text-sm' }, formatDate(row.original.dateUpdated)),
  },
]);

// Batch actions
const batchActions: BatchAction[] = [
  { id: 'delete', label: 'Supprimer', icon: 'trash', variant: 'danger' },
  { id: 'draft', label: 'Brouillon', icon: 'archive' },
];

function handleSelectionChange(selected: Product[]) {
  selectedProducts.value = selected;
}

async function setProductsStatus(status: 'draft' | 'published' | 'archived') {
  let failed = 0;
  for (const p of selectedProducts.value) {
    const { error } = await api.products({ id: p.id }).patch({ status });
    if (error) failed++;
  }
  selectedProducts.value = [];
  await loadProducts();
  if (failed > 0) toast.error(`Échec du changement de statut de ${failed} produit(s)`);
}

function handleBatchAction(actionId: string) {
  if (actionId === 'delete') {
    confirmDeleteSelected();
  } else if (actionId === 'draft') {
    setProductsStatus('draft');
  }
}

const deleteMessage = computed(() => {
  const count = selectedProducts.value.length;
  if (count === 1) {
    return `Voulez-vous vraiment supprimer le produit « ${selectedProducts.value[0].name} » ? Cette action est irreversible.`;
  }
  return `Voulez-vous vraiment supprimer ces ${count} produits ? Cette action est irreversible.`;
});
</script>

<template>
  <div>
    <DataTable
      :data="products"
      :columns="columns"
      :loading="loading"
      :batch-actions="batchActions"
      :on-batch-action="handleBatchAction"
      search-placeholder="Rechercher un produit..."
      server-search
      server-sort
      add-label="Nouveau produit"
      empty-message="Aucun produit"
      :on-row-click="openEdit"
      @add="openCreate"
      @search="onSearch"
      @sort="handleSort"
      @selection-change="handleSelectionChange"
    />

    <Pagination
      v-if="paginationMeta.totalPages > 1"
      :page="paginationMeta.page"
      :total-pages="paginationMeta.totalPages"
      :total="paginationMeta.total"
      :limit="paginationMeta.limit"
      @update:page="setPage"
    />

    <ConfirmModal
      :open="deleteModalOpen"
      title="Supprimer les produits"
      :message="deleteMessage"
      confirm-label="Supprimer"
      @confirm="deleteSelectedProducts"
      @cancel="cancelDelete"
    />
  </div>
</template>
