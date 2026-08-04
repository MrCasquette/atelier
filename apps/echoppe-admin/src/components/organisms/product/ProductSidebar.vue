<script setup lang="ts">
import Label from '@/components/atoms/Label.vue';
import Select from '@/components/atoms/Select.vue';
import type { SelectOption } from '@/composables/product';

defineProps<{
  isNew: boolean;
  slug: string;
  dateCreated: string;
  dateUpdated: string;
  categoryOptions: SelectOption[];
  collectionOptions: SelectOption[];
  taxRateOptions: SelectOption[];
  statusOptions: SelectOption[];
}>();

const status = defineModel<string>('status', { required: true });
const category = defineModel<string>('category', { required: true });
const collection = defineModel<string>('collection', { required: true });
const taxRate = defineModel<string>('taxRate', { required: true });
</script>

<template>
  <div class="w-80 flex-shrink-0 space-y-6">
    <!-- Status card -->
    <div class="bg-white rounded-lg shadow p-5">
      <h3 class="font-semibold text-gray-900 mb-4">
        Publication
      </h3>
      <div>
        <Label>Statut</Label>
        <Select
          v-model="status"
          :options="statusOptions"
        />
      </div>
    </div>

    <!-- Organization card -->
    <div class="bg-white rounded-lg shadow p-5">
      <h3 class="font-semibold text-gray-900 mb-4">
        Organisation
      </h3>
      <div class="space-y-4">
        <div>
          <Label required>Catégorie</Label>
          <Select
            v-model="category"
            :options="categoryOptions"
            placeholder="Sélectionner une catégorie"
          />
        </div>
        <div>
          <Label>Collection</Label>
          <Select
            v-model="collection"
            :options="collectionOptions"
          />
        </div>
      </div>
    </div>

    <!-- Tax card -->
    <div class="bg-white rounded-lg shadow p-5">
      <h3 class="font-semibold text-gray-900 mb-4">
        Fiscalité
      </h3>
      <div>
        <Label required>Taux de TVA</Label>
        <Select
          v-model="taxRate"
          :options="taxRateOptions"
        />
      </div>
    </div>

    <!-- Metadata card (only for existing products) -->
    <div
      v-if="!isNew"
      class="bg-white rounded-lg shadow p-5"
    >
      <h3 class="font-semibold text-gray-900 mb-4">
        Informations
      </h3>
      <div class="space-y-4">
        <div>
          <Label>Slug</Label>
          <div class="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-600 font-mono">
            {{ slug }}
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <span class="text-sm text-gray-500">Créé le</span>
            <div class="text-sm text-gray-700">
              {{ dateCreated }}
            </div>
          </div>
          <div>
            <span class="text-sm text-gray-500">Modifié le</span>
            <div class="text-sm text-gray-700">
              {{ dateUpdated }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
