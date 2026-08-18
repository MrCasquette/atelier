<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CategoriesView from '@/views/CategoriesView.vue';
import CollectionsView from '@/views/CollectionsView.vue';
import { query } from '@/lib/route';

const route = useRoute();
const router = useRouter();

const tabs = [
  { id: 'categories', label: 'Catégories' },
  { id: 'collections', label: 'Collections' },
] as const;

type TabId = (typeof tabs)[number]['id'];

/** L'onglet demandé par l'URL, s'il existe — sinon rien, et l'appelant retombe sur le sien. */
const asTabId = (value: string | null): TabId | null =>
  tabs.find((tab) => tab.id === value)?.id ?? null;

const activeTab = computed<TabId>({
  get: () => asTabId(query(route.query.tab)) ?? 'categories',
  set: (value) => {
    router.replace({ query: { tab: value } });
  },
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">
      Organisation
    </h1>

    <!-- Tabs -->
    <div class="border-b border-gray-200 mb-6">
      <nav class="-mb-px flex gap-6">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="pb-3 text-sm font-medium transition-colors"
          :class="[
            activeTab === tab.id
              ? 'border-b-2 border-indigo-500 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Tab content -->
    <CategoriesView v-if="activeTab === 'categories'" />
    <CollectionsView v-else-if="activeTab === 'collections'" />
  </div>
</template>
