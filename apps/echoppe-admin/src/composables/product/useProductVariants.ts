import { ref, computed, h, type Ref, type ComputedRef } from 'vue';
import { api } from '@/lib/api';
import { useSortable, type FlatDropPosition } from '@/composables/sortable';
import type { Variant, Option } from './types';
import type { DataTableColumn } from '@/components/organisms/DataTable/types';
import Badge from '@/components/atoms/Badge.vue';
import IconButton from '@/components/atoms/IconButton.vue';
import Thumbnail from '@/components/atoms/Thumbnail.vue';
import TrashIcon from '@/components/atoms/icons/TrashIcon.vue';
import EditIcon from '@/components/atoms/icons/EditIcon.vue';

// Variant row type for DataTable
export type VariantRecord = Variant & Record<string, unknown>;

interface UseProductVariantsOptions {
  productId: ComputedRef<string | null>;
  variants: Ref<Variant[]>;
  options: Ref<Option[]>;
  variantThumbnails: Ref<Map<string, string>>;
  onReload: () => Promise<void>;
}

export function useProductVariants({
  productId,
  variants,
  options,
  variantThumbnails,
  onReload,
}: UseProductVariantsOptions) {
  // Modal state
  const showVariantModal = ref(false);
  const editingVariant = ref<Variant | null>(null);

  // Sortable instance
  const variantSortable = useSortable({
    dropZoneAttr: 'data-datatable-drop',
    onReorder: () => {},
  });

  // Status helpers
  function getStatusBadge(status: string): 'success' | 'warning' | 'default' {
    switch (status) {
      case 'published':
        return 'success';
      case 'draft':
        return 'warning';
      default:
        return 'default';
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'published':
        return 'Publié';
      case 'draft':
        return 'Brouillon';
      case 'archived':
        return 'Archivé';
      default:
        return status;
    }
  }

  // Modal functions
  function openVariantModal(variant?: Variant) {
    editingVariant.value = variant ?? null;
    showVariantModal.value = true;
  }

  function closeVariantModal() {
    showVariantModal.value = false;
    editingVariant.value = null;
  }

  async function onVariantSaved() {
    await onReload();
    closeVariantModal();
  }

  function updateOptions(newOptions: Option[]) {
    options.value = newOptions;
  }

  // Delete variant
  async function deleteVariant(variantId: string) {
    if (!productId.value) return;
    await api.products({ id: productId.value }).variants({ variantId }).delete();
    variants.value = variants.value.filter((v) => v.id !== variantId);
  }

  // Reorder variants
  async function handleVariantReorder(draggedId: string, targetId: string, position: FlatDropPosition) {
    if (!productId.value) return;

    const sortableItems = variants.value.map((v) => ({ id: v.id, sortOrder: v.sortOrder }));
    const newOrder = variantSortable.calculateNewOrder(sortableItems, draggedId, targetId, position);

    if (newOrder.length === 0) return;

    // Update locally first
    const reorderedVariants = [...variants.value].sort((a, b) => {
      const aOrder = newOrder.find((o) => o.id === a.id)?.sortOrder ?? a.sortOrder;
      const bOrder = newOrder.find((o) => o.id === b.id)?.sortOrder ?? b.sortOrder;
      return aOrder - bOrder;
    });
    variants.value = reorderedVariants;

    // Update API
    await Promise.all(
      newOrder.map(({ id, sortOrder }) => {
        const v = variants.value.find((variant) => variant.id === id)!;
        return api
          .products({ id: productId.value! })
          .variants({ variantId: id })
          .put({
            priceHt: parseFloat(v.priceHt),
            sortOrder,
            sku: v.sku ?? undefined,
            barcode: v.barcode ?? undefined,
            compareAtPriceHt: v.compareAtPriceHt ? parseFloat(v.compareAtPriceHt) : undefined,
            costPrice: v.costPrice ? parseFloat(v.costPrice) : undefined,
            weight: v.weight ? parseFloat(v.weight) : undefined,
            length: v.length ? parseFloat(v.length) : undefined,
            width: v.width ? parseFloat(v.width) : undefined,
            height: v.height ? parseFloat(v.height) : undefined,
            isDefault: v.isDefault,
            status: v.status,
            quantity: v.quantity,
            lowStockThreshold: v.lowStockThreshold ?? undefined,
          });
      })
    );

    await onReload();
  }

  // DataTable columns
  const variantColumns = computed<DataTableColumn<VariantRecord>[]>(() => [
    {
      id: 'thumbnail',
      label: '',
      accessorKey: 'id',
      size: 64,
      sortable: false,
      hideable: false,
      cell: ({ row }) =>
        h(Thumbnail, {
          src: variantThumbnails.value.get(row.original.id) || null,
          alt: row.original.sku || 'Variante',
          size: 'md',
        }),
    },
    {
      id: 'sku',
      label: 'SKU',
      accessorKey: 'sku',
      cell: ({ row }) => h('span', { class: 'font-mono text-xs text-gray-400' }, row.original.sku || '-'),
    },
    {
      id: 'barcode',
      label: 'Code-barres',
      accessorKey: 'barcode',
      defaultVisible: false,
      cell: ({ row }) => h('span', { class: 'font-mono text-gray-500 text-sm' }, row.original.barcode || '-'),
    },
    {
      id: 'priceHt',
      label: 'Prix HT',
      accessorKey: 'priceHt',
      cell: ({ row }) => h('span', { class: 'font-medium' }, `${row.original.priceHt} €`),
    },
    {
      id: 'compareAtPriceHt',
      label: 'Prix barré',
      accessorKey: 'compareAtPriceHt',
      defaultVisible: false,
      cell: ({ row }) =>
        h('span', { class: 'text-gray-500' }, row.original.compareAtPriceHt ? `${row.original.compareAtPriceHt} €` : '-'),
    },
    {
      id: 'costPrice',
      label: "Coût d'achat",
      accessorKey: 'costPrice',
      defaultVisible: false,
      cell: ({ row }) =>
        h('span', { class: 'text-gray-500' }, row.original.costPrice ? `${row.original.costPrice} €` : '-'),
    },
    {
      id: 'quantity',
      label: 'Stock',
      accessorKey: 'quantity',
      cell: ({ row }) =>
        h(
          'span',
          { class: row.original.quantity > 0 ? 'text-gray-900' : 'text-red-600 font-medium' },
          String(row.original.quantity)
        ),
    },
    {
      id: 'weight',
      label: 'Poids',
      accessorKey: 'weight',
      defaultVisible: false,
      cell: ({ row }) => h('span', { class: 'text-gray-500' }, row.original.weight ? `${row.original.weight} kg` : '-'),
    },
    {
      id: 'status',
      label: 'Statut',
      accessorKey: 'status',
      cell: ({ row }) =>
        h(Badge, { variant: getStatusBadge(row.original.status), size: 'sm' }, () =>
          getStatusLabel(row.original.status)
        ),
    },
    {
      id: 'actions',
      label: '',
      sortable: false,
      hideable: false,
      size: 90,
      cell: ({ row }) =>
        h('div', { class: 'flex items-center gap-1' }, [
          h(
            IconButton,
            {
              variant: 'ghost',
              size: 'sm',
              title: 'Modifier',
              class: 'text-gray-400 hover:text-blue-600 hover:bg-blue-50',
              onClick: (e: Event) => {
                e.stopPropagation();
                openVariantModal(row.original as Variant);
              },
            },
            () => h(EditIcon, { class: 'w-4 h-4' })
          ),
          h(
            IconButton,
            {
              variant: 'ghost',
              size: 'sm',
              title: 'Supprimer',
              class: 'text-gray-400 hover:text-red-600 hover:bg-red-50',
              onClick: (e: Event) => {
                e.stopPropagation();
                deleteVariant(row.original.id);
              },
            },
            () => h(TrashIcon, { class: 'w-4 h-4' })
          ),
        ]),
    },
  ]);

  // Data for DataTable
  const variantsData = computed<VariantRecord[]>(() => variants.value as VariantRecord[]);

  function getVariantRowId(row: VariantRecord): string {
    return row.id;
  }

  function handleAddVariant() {
    openVariantModal();
  }

  return {
    // Modal state
    showVariantModal,
    editingVariant,

    // DataTable
    variantColumns,
    variantsData,
    getVariantRowId,

    // Actions
    openVariantModal,
    closeVariantModal,
    onVariantSaved,
    updateOptions,
    deleteVariant,
    handleVariantReorder,
    handleAddVariant,

    // Helpers
    getStatusBadge,
    getStatusLabel,
  };
}
