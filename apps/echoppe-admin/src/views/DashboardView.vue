<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/lib/api';

const productsCount = ref(0);
const categoriesCount = ref(0);
const loading = ref(true);

onMounted(async () => {
  try {
    const [productsRes, categoriesRes] = await Promise.all([
      api.products.get({ query: { limit: 1 } }),
      api.categories.get(),
    ]);

    if (productsRes.data && 'meta' in productsRes.data) productsCount.value = productsRes.data.meta.total;
    if (categoriesRes.data) categoriesCount.value = categoriesRes.data.length;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">
      Tableau de bord
    </h1>

    <div
      v-if="loading"
      class="text-gray-500"
    >
      Chargement...
    </div>

    <div
      v-else
      class="grid grid-cols-1 md:grid-cols-3 gap-6"
    >
      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-sm text-gray-500 mb-1">
          Produits
        </p>
        <p class="text-3xl font-bold text-gray-900">
          {{ productsCount }}
        </p>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-sm text-gray-500 mb-1">
          Categories
        </p>
        <p class="text-3xl font-bold text-gray-900">
          {{ categoriesCount }}
        </p>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-sm text-gray-500 mb-1">
          Commandes
        </p>
        <p class="text-3xl font-bold text-gray-900">
          0
        </p>
      </div>
    </div>
  </div>
</template>
