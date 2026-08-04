<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PaymentsView from '@/views/PaymentsView.vue';
import ShippingView from '@/views/ShippingView.vue';
import CommunicationsView from '@/views/CommunicationsView.vue';

const route = useRoute();
const router = useRouter();

const tabs = [
  { id: 'paiement', label: 'Paiement' },
  { id: 'livraison', label: 'Livraison' },
  { id: 'communication', label: 'Communication' },
] as const;

type TabId = (typeof tabs)[number]['id'];

const activeTab = computed<TabId>({
  get: () => (route.query.tab as TabId) || 'paiement',
  set: (value) => {
    router.replace({ query: { tab: value } });
  },
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">
      Prestataires
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
    <PaymentsView v-if="activeTab === 'paiement'" />
    <ShippingView v-else-if="activeTab === 'livraison'" />
    <CommunicationsView v-else-if="activeTab === 'communication'" />
  </div>
</template>
