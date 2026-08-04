<script setup lang="ts">
import DataTable from '@/components/organisms/DataTable/DataTable.vue';
import type { DataTableColumn } from '@/components/organisms/DataTable/types';
import type { VariantRecord } from '@/composables/product';
import type { FlatDropPosition } from '@/composables/sortable';

defineProps<{
  variants: VariantRecord[];
  columns: DataTableColumn<VariantRecord>[];
  rowId: (row: VariantRecord) => string;
  onReorder: (draggedId: string, targetId: string, position: FlatDropPosition) => Promise<void>;
}>();

const emit = defineEmits<{
  add: [];
}>();
</script>

<template>
  <div class="bg-white rounded-lg shadow p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-medium text-gray-900">
        Variantes ({{ variants.length }})
      </h3>
    </div>
    <DataTable
      :data="variants"
      :columns="columns"
      :selectable="false"
      :searchable="false"
      :filterable="false"
      :reorderable="true"
      :row-id="rowId"
      :on-reorder="onReorder"
      add-label="Ajouter une variante"
      empty-message="Aucune variante pour ce produit"
      @add="emit('add')"
    />
  </div>
</template>
