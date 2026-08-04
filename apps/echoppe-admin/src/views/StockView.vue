<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/lib/api';
import { useToast } from '@/composables/useToast';
import Button from '@/components/atoms/Button.vue';
import Modal from '@/components/atoms/Modal.vue';
import type { ApiItem, ApiPaginatedItem } from '@/types/api';

type StockMove = ApiPaginatedItem<ReturnType<typeof api.stock.get>>;
type Alert = ApiItem<ReturnType<typeof api.stock.alerts.get>>;
type VariantOption = ApiItem<ReturnType<typeof api.stock.variants.get>>;

const router = useRouter();
const toast = useToast();

const activeTab = ref<'alerts' | 'moves'>('alerts');
const loading = ref(true);

// Alerts
const alerts = ref<Alert[]>([]);

// Moves
const moves = ref<StockMove[]>([]);
const page = ref(1);
const limit = ref(20);
const totalPages = ref(1);
const total = ref(0);

// Modal
const showModal = ref(false);
const saving = ref(false);
const variants = ref<VariantOption[]>([]);
const form = ref({
  variant: '',
  quantity: 0,
  type: 'adjustment' as 'adjustment' | 'restock',
  note: '',
});

const typeLabels: Record<string, { label: string; color: string }> = {
  sale: { label: 'Vente', color: 'bg-red-100 text-red-700' },
  return: { label: 'Retour', color: 'bg-green-100 text-green-700' },
  restock: { label: 'Réappro', color: 'bg-blue-100 text-blue-700' },
  adjustment: { label: 'Ajustement', color: 'bg-gray-100 text-gray-700' },
  reservation: { label: 'Réservation', color: 'bg-yellow-100 text-yellow-700' },
};

async function loadAlerts() {
  const { data } = await api.stock.alerts.get();
  if (data) alerts.value = data;
}

async function loadMoves() {
  loading.value = true;
  const { data } = await api.stock.get({ query: { page: page.value, limit: limit.value } });
  if (data) {
    moves.value = data.data;
    totalPages.value = data.meta.totalPages;
    total.value = data.meta.total;
  }
  loading.value = false;
}

async function loadVariants() {
  const { data } = await api.stock.variants.get();
  if (data) variants.value = data;
}

onMounted(async () => {
  await Promise.all([loadAlerts(), loadMoves(), loadVariants()]);
  loading.value = false;
});

watch(page, loadMoves);

function openModal() {
  form.value = { variant: '', quantity: 0, type: 'adjustment', note: '' };
  showModal.value = true;
}

async function saveMove() {
  if (!form.value.variant || form.value.quantity === 0) {
    toast.error('Veuillez sélectionner une variante et une quantité');
    return;
  }

  saving.value = true;
  try {
    const { error } = await api.stock.post({
      variant: form.value.variant,
      quantity: form.value.quantity,
      type: form.value.type,
      note: form.value.note || undefined,
    });

    if (error) {
      toast.error('Erreur lors de la création du mouvement');
    } else {
      toast.success('Mouvement enregistré');
      showModal.value = false;
      await Promise.all([loadAlerts(), loadMoves()]);
    }
  } catch {
    toast.error('Erreur lors de la création du mouvement');
  } finally {
    saving.value = false;
  }
}

function goToProduct(productId: string) {
  router.push(`/produits/${productId}`);
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatQuantity(qty: number) {
  return qty > 0 ? `+${qty}` : qty.toString();
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">
        Stock
      </h1>
      <Button
        variant="primary"
        size="lg"
        @click="openModal"
      >
        Ajustement
      </Button>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 mb-6">
      <nav class="-mb-px flex gap-6">
        <button
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'alerts'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
          @click="activeTab = 'alerts'"
        >
          Alertes
          <span
            v-if="alerts.length > 0"
            class="ml-2 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700"
          >
            {{ alerts.length }}
          </span>
        </button>
        <button
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'moves'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
          @click="activeTab = 'moves'"
        >
          Mouvements
          <span class="ml-2 text-xs text-gray-400">
            ({{ total }})
          </span>
        </button>
      </nav>
    </div>

    <!-- Alerts Tab -->
    <div
      v-if="activeTab === 'alerts'"
      class="bg-white rounded-lg shadow overflow-hidden"
    >
      <div
        v-if="alerts.length === 0"
        class="p-8 text-center text-gray-500"
      >
        Aucune alerte de stock bas
      </div>
      <table
        v-else
        class="w-full"
      >
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
              Produit
            </th>
            <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
              SKU
            </th>
            <th class="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">
              Stock
            </th>
            <th class="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">
              Seuil
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr
            v-for="alert in alerts"
            :key="alert.variantId"
            class="hover:bg-gray-50 cursor-pointer transition-colors"
            @click="goToProduct(alert.productId)"
          >
            <td class="px-6 py-4 font-medium text-gray-900">
              {{ alert.productName }}
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
              {{ alert.sku || '-' }}
            </td>
            <td class="px-6 py-4 text-center">
              <span
                :class="[
                  'inline-flex px-2 py-1 text-sm font-medium rounded',
                  alert.quantity === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                ]"
              >
                {{ alert.quantity }}
              </span>
            </td>
            <td class="px-6 py-4 text-center text-sm text-gray-500">
              {{ alert.lowStockThreshold ?? 5 }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Moves Tab -->
    <div
      v-if="activeTab === 'moves'"
      class="bg-white rounded-lg shadow overflow-hidden"
    >
      <div
        v-if="loading"
        class="p-8 text-center text-gray-500"
      >
        Chargement...
      </div>
      <div
        v-else-if="moves.length === 0"
        class="p-8 text-center text-gray-500"
      >
        Aucun mouvement de stock
      </div>
      <template v-else>
        <table class="w-full">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Produit
              </th>
              <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th class="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Quantité
              </th>
              <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Note
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr
              v-for="move in moves"
              :key="move.id"
              class="hover:bg-gray-50"
            >
              <td class="px-6 py-4 text-sm text-gray-500">
                {{ formatDate(move.dateCreated) }}
              </td>
              <td class="px-6 py-4 font-medium text-gray-900">
                {{ move.label }}
              </td>
              <td class="px-6 py-4">
                <span
                  :class="[
                    'inline-flex px-2 py-1 text-xs font-medium rounded',
                    typeLabels[move.type]?.color || 'bg-gray-100 text-gray-700'
                  ]"
                >
                  {{ typeLabels[move.type]?.label || move.type }}
                </span>
              </td>
              <td class="px-6 py-4 text-center">
                <span
                  :class="[
                    'font-medium',
                    move.quantity > 0 ? 'text-green-600' : 'text-red-600'
                  ]"
                >
                  {{ formatQuantity(move.quantity) }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">
                {{ move.note || '-' }}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div
          v-if="totalPages > 1"
          class="px-6 py-4 border-t border-gray-200 flex items-center justify-between"
        >
          <p class="text-sm text-gray-500">
            Page {{ page }} sur {{ totalPages }}
          </p>
          <div class="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              :disabled="page <= 1"
              @click="page--"
            >
              Précédent
            </Button>
            <Button
              variant="secondary"
              size="sm"
              :disabled="page >= totalPages"
              @click="page++"
            >
              Suivant
            </Button>
          </div>
        </div>
      </template>
    </div>

    <!-- Modal Ajustement -->
    <Modal
      v-if="showModal"
      title="Ajustement de stock"
      size="md"
      @close="showModal = false"
    >
      <form
        class="space-y-4"
        @submit.prevent="saveMove"
      >
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Variante *</label>
          <select
            v-model="form.variant"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">
              Sélectionner...
            </option>
            <option
              v-for="v in variants"
              :key="v.id"
              :value="v.id"
            >
              {{ v.productName }}{{ v.sku ? ` — ${v.sku}` : '' }} (stock: {{ v.quantity }})
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select
            v-model="form.type"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="adjustment">
              Ajustement
            </option>
            <option value="restock">
              Réapprovisionnement
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
          <input
            v-model.number="form.quantity"
            type="number"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p class="text-xs text-gray-500 mt-1">
            Positif pour ajouter, négatif pour retirer
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Note</label>
          <textarea
            v-model="form.note"
            rows="2"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </form>

      <template #footer>
        <Button
          variant="secondary"
          size="lg"
          @click="showModal = false"
        >
          Annuler
        </Button>
        <Button
          variant="primary"
          size="lg"
          :loading="saving"
          @click="saveMove"
        >
          Enregistrer
        </Button>
      </template>
    </Modal>
  </div>
</template>
