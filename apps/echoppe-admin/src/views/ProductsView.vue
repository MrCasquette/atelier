<script setup lang="ts">
import OptionsCatalogView from '@/views/OptionsCatalogView.vue';
import ProductCatalogView from '@/views/ProductCatalogView.vue';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const tabs = [
  { id: 'produits', label: 'Produits' },
  { id: 'options', label: 'Options' },
] as const;

type TabId = (typeof tabs)[number]['id'];

const activeTab = computed<TabId>({
  get: () => (route.query.tab === 'options' ? 'options' : 'produits'),
  set: (value) => {
    // Change d'onglet en repartant d'une query propre (pas de page/tri hérités).
    router.replace({ query: value === 'produits' ? {} : { tab: value } });
  },
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">
      Produits
    </h1>

    <div class="border-b border-gray-200 mb-6">
      <nav class="-mb-px flex gap-6">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="pb-3 text-sm font-medium transition-colors cursor-pointer"
          :class="
            activeTab === tab.id
              ? 'border-b-2 border-indigo-500 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          "
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <ProductCatalogView v-if="activeTab === 'produits'" />
    <OptionsCatalogView v-else-if="activeTab === 'options'" />
  </div>
</template>
