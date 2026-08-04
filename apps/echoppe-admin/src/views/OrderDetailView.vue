<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/lib/api';
import { useToast } from '@/composables/useToast';
import Badge from '@/components/atoms/Badge.vue';
import Button from '@/components/atoms/Button.vue';
import type { StatusVariant } from '@/types/ui';
import Modal from '@/components/atoms/Modal.vue';

// Types inférés depuis Eden
type OrderDetailResponse = Awaited<ReturnType<ReturnType<typeof api.orders>['get']>>;
type OrderDetail = NonNullable<OrderDetailResponse['data']>;

interface Invoice {
  id: string;
  type: string;
  number: string;
  status: string;
  totalHt: string;
  totalTax: string;
  totalTtc: string;
  dateIssued: string;
  dateDue: string | null;
  hasPdf: boolean;
}

const route = useRoute();
const router = useRouter();
const toast = useToast();

const order = ref<OrderDetail | null>(null);
const loading = ref(true);
const saving = ref(false);

// Invoices
const invoices = ref<Invoice[]>([]);
const invoiceLoading = ref(false);

// Status change modal
const showStatusModal = ref(false);
const newStatus = ref<string>('');

// Notes
const internalNote = ref('');
const notesEdited = ref(false);

const orderId = computed(() => route.params.id as string);

async function loadOrder() {
  loading.value = true;
  try {
    const { data } = await api.orders({ id: orderId.value }).get();
    if (data) {
      order.value = data;
      internalNote.value = data.internalNote || '';
    }
  } catch {
    toast.error('Erreur lors du chargement de la commande');
    router.push('/commandes');
  } finally {
    loading.value = false;
  }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7532';

async function loadInvoices() {
  try {
    const res = await fetch(`${API_URL}/orders/${orderId.value}/invoices`, {
      credentials: 'include',
    });
    if (res.ok) {
      invoices.value = await res.json();
    }
  } catch {
    // Silently fail - invoices are optional
  }
}

async function createInvoice() {
  invoiceLoading.value = true;
  try {
    const res = await fetch(`${API_URL}/orders/${orderId.value}/invoice`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      toast.success(`Facture ${data.number} créée`);
      await loadInvoices();
      // Télécharger automatiquement après création
      downloadInvoice(data.id);
    } else {
      throw new Error('Failed to create invoice');
    }
  } catch {
    toast.error('Erreur lors de la création de la facture');
  } finally {
    invoiceLoading.value = false;
  }
}

function downloadInvoice(invoiceId: string) {
  // Ouvrir le PDF dans un nouvel onglet (l'API gère la régénération si fichier manquant)
  const url = `${API_URL}/orders/${orderId.value}/invoices/${invoiceId}/pdf`;
  window.open(url, '_blank');
}

onMounted(() => {
  loadOrder();
  loadInvoices();
});

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
    month: 'long',
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

function formatAddress(address: Record<string, unknown>) {
  const parts = [
    address.firstName && address.lastName ? `${address.firstName} ${address.lastName}` : '',
    address.company,
    address.street,
    address.street2,
    `${address.postalCode} ${address.city}`,
    address.country,
  ].filter(Boolean);
  return parts.join('\n');
}

const availableStatuses = computed(() => {
  if (!order.value) return [];
  const current = order.value.status;

  // Define allowed transitions
  const transitions: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered', 'cancelled'],
    delivered: ['refunded'],
    cancelled: [],
    refunded: [],
  };

  return transitions[current] || [];
});

function openStatusModal(status: string) {
  newStatus.value = status;
  showStatusModal.value = true;
}

async function confirmStatusChange() {
  if (!order.value || !newStatus.value) return;

  saving.value = true;
  try {
    const { error } = await api.orders({ id: orderId.value }).status.patch({
      status: newStatus.value as 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded',
    });
    if (error) {
      toast.error('Erreur lors de la mise à jour');
      return;
    }
    toast.success('Statut mis à jour');
    showStatusModal.value = false;
    await loadOrder();
  } catch {
    toast.error('Erreur lors de la mise à jour');
  } finally {
    saving.value = false;
  }
}

async function saveNotes() {
  if (!order.value) return;

  saving.value = true;
  try {
    const { error } = await api.orders({ id: orderId.value }).notes.patch({
      internalNote: internalNote.value,
    });
    if (error) {
      toast.error("Erreur lors de l'enregistrement");
      return;
    }
    toast.success('Notes enregistrées');
    notesEdited.value = false;
  } catch {
    toast.error("Erreur lors de l'enregistrement");
  } finally {
    saving.value = false;
  }
}

function getPaymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'En attente',
    completed: 'Payé',
    failed: 'Échoué',
    refunded: 'Remboursé',
  };
  return labels[status] || status;
}

function getShipmentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'En attente',
    label_created: 'Étiquette créée',
    shipped: 'Expédié',
    in_transit: 'En transit',
    delivered: 'Livré',
    returned: 'Retourné',
  };
  return labels[status] || status;
}
</script>

<template>
  <div
    v-if="loading"
    class="flex items-center justify-center h-64"
  >
    <div class="text-gray-500">
      Chargement...
    </div>
  </div>

  <div
    v-else-if="order"
    class="flex gap-6"
  >
    <!-- Main content -->
    <div class="flex-1 space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button
            type="button"
            class="p-2 text-gray-400 hover:text-gray-600"
            @click="router.push('/commandes')"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h1 class="text-2xl font-bold text-gray-900 font-mono">
              {{ order.orderNumber }}
            </h1>
            <p class="text-sm text-gray-500">
              {{ formatDate(order.dateCreated) }}
            </p>
          </div>
        </div>
        <Badge :variant="getStatusConfig(order.status).variant">
          {{ getStatusConfig(order.status).label }}
        </Badge>
      </div>

      <!-- Order Items -->
      <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">
            Articles
          </h2>
        </div>
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Produit
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Prix unitaire
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Quantité
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr
              v-for="item in order.items"
              :key="item.id"
            >
              <td class="px-6 py-4">
                <p class="font-medium text-gray-900">
                  {{ item.label }}
                </p>
              </td>
              <td class="px-6 py-4 text-right text-gray-500">
                {{ formatPrice(item.unitPriceHt) }}
              </td>
              <td class="px-6 py-4 text-right text-gray-500">
                {{ item.quantity }}
              </td>
              <td class="px-6 py-4 text-right font-medium text-gray-900">
                {{ formatPrice(item.totalTtc) }}
              </td>
            </tr>
          </tbody>
          <tfoot class="bg-gray-50">
            <tr>
              <td
                colspan="3"
                class="px-6 py-3 text-right text-sm text-gray-500"
              >
                Sous-total HT
              </td>
              <td class="px-6 py-3 text-right font-medium text-gray-900">
                {{ formatPrice(order.subtotalHt) }}
              </td>
            </tr>
            <tr v-if="parseFloat(order.shippingHt) > 0">
              <td
                colspan="3"
                class="px-6 py-3 text-right text-sm text-gray-500"
              >
                Livraison HT
              </td>
              <td class="px-6 py-3 text-right font-medium text-gray-900">
                {{ formatPrice(order.shippingHt) }}
              </td>
            </tr>
            <tr v-if="parseFloat(order.discountHt) > 0">
              <td
                colspan="3"
                class="px-6 py-3 text-right text-sm text-gray-500"
              >
                Remise
              </td>
              <td class="px-6 py-3 text-right font-medium text-green-600">
                -{{ formatPrice(order.discountHt) }}
              </td>
            </tr>
            <tr>
              <td
                colspan="3"
                class="px-6 py-3 text-right text-sm text-gray-500"
              >
                TVA
              </td>
              <td class="px-6 py-3 text-right font-medium text-gray-900">
                {{ formatPrice(order.totalTax) }}
              </td>
            </tr>
            <tr class="border-t border-gray-300">
              <td
                colspan="3"
                class="px-6 py-4 text-right text-lg font-semibold text-gray-900"
              >
                Total TTC
              </td>
              <td class="px-6 py-4 text-right text-lg font-bold text-gray-900">
                {{ formatPrice(order.totalTtc) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Notes -->
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">
          Notes internes
        </h2>
        <textarea
          v-model="internalNote"
          rows="4"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Notes visibles uniquement par l'équipe..."
          @input="notesEdited = true"
        />
        <div
          v-if="notesEdited"
          class="mt-3 flex justify-end"
        >
          <Button
            variant="primary"
            size="sm"
            :loading="saving"
            @click="saveNotes"
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </div>

    <!-- Sidebar -->
    <div class="w-80 space-y-6">
      <!-- Actions -->
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">
          Actions
        </h3>
        <div class="space-y-2">
          <!-- Invoice -->
          <Button
            v-if="invoices.length === 0"
            variant="primary"
            size="sm"
            class="w-full"
            :loading="invoiceLoading"
            @click="createInvoice"
          >
            Créer la facture
          </Button>
          <Button
            v-for="inv in invoices"
            :key="inv.id"
            variant="secondary"
            size="sm"
            class="w-full"
            @click="downloadInvoice(inv.id)"
          >
            Télécharger {{ inv.number }}
          </Button>

          <!-- Status changes -->
          <Button
            v-for="status in availableStatuses"
            :key="status"
            :variant="status === 'cancelled' ? 'danger' : 'secondary'"
            size="sm"
            class="w-full"
            @click="openStatusModal(status)"
          >
            {{ getStatusConfig(status).label }}
          </Button>
          <p
            v-if="availableStatuses.length === 0 && invoices.length > 0"
            class="text-sm text-gray-500 text-center py-2"
          >
            Aucune action disponible
          </p>
        </div>
      </div>

      <!-- Customer -->
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">
          Client
        </h3>
        <div class="space-y-2">
          <p class="font-medium text-gray-900">
            {{ order.customer.firstName }} {{ order.customer.lastName }}
          </p>
          <p class="text-sm text-gray-500">
            {{ order.customer.email }}
          </p>
          <p
            v-if="order.customer.phone"
            class="text-sm text-gray-500"
          >
            {{ order.customer.phone }}
          </p>
        </div>
      </div>

      <!-- Shipping Address -->
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">
          Adresse de livraison
        </h3>
        <p class="text-sm text-gray-600 whitespace-pre-line">
          {{ formatAddress(order.shippingAddress as Record<string, unknown>) }}
        </p>
      </div>

      <!-- Billing Address -->
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">
          Adresse de facturation
        </h3>
        <p class="text-sm text-gray-600 whitespace-pre-line">
          {{ formatAddress(order.billingAddress as Record<string, unknown>) }}
        </p>
      </div>

      <!-- Payment -->
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">
          Paiement
        </h3>
        <div
          v-if="order.payment"
          class="space-y-2"
        >
          <div class="flex justify-between">
            <span class="text-sm text-gray-500">Provider</span>
            <span class="text-sm font-medium text-gray-900 capitalize">{{ order.payment.provider }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-500">Statut</span>
            <span class="text-sm font-medium text-gray-900">{{ getPaymentStatusLabel(order.payment.status) }}</span>
          </div>
          <div
            v-if="order.payment.providerTransactionId"
            class="flex justify-between"
          >
            <span class="text-sm text-gray-500">Transaction</span>
            <span class="text-sm font-mono text-gray-600 truncate max-w-32">{{ order.payment.providerTransactionId }}</span>
          </div>
        </div>
        <p
          v-else
          class="text-sm text-gray-500"
        >
          Aucun paiement
        </p>
      </div>

      <!-- Shipment -->
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">
          Expédition
        </h3>
        <div
          v-if="order.shipment"
          class="space-y-2"
        >
          <div class="flex justify-between">
            <span class="text-sm text-gray-500">Transporteur</span>
            <span class="text-sm font-medium text-gray-900">{{ order.shipment.provider?.name || '-' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-500">Statut</span>
            <span class="text-sm font-medium text-gray-900">{{ getShipmentStatusLabel(order.shipment.status) }}</span>
          </div>
          <div
            v-if="order.shipment.trackingNumber"
            class="flex justify-between"
          >
            <span class="text-sm text-gray-500">Suivi</span>
            <a
              v-if="order.shipment.trackingUrl"
              :href="order.shipment.trackingUrl"
              target="_blank"
              class="text-sm text-blue-600 hover:underline"
            >
              {{ order.shipment.trackingNumber }}
            </a>
            <span
              v-else
              class="text-sm font-mono text-gray-600"
            >{{ order.shipment.trackingNumber }}</span>
          </div>
        </div>
        <p
          v-else
          class="text-sm text-gray-500"
        >
          Non expédiée
        </p>
      </div>
    </div>
  </div>

  <!-- Status Change Modal -->
  <Modal
    v-if="showStatusModal"
    :title="`Changer le statut`"
    size="sm"
    @close="showStatusModal = false"
  >
    <p class="text-gray-600">
      Voulez-vous passer cette commande en
      <strong>{{ getStatusConfig(newStatus).label }}</strong> ?
    </p>

    <template #footer>
      <Button
        variant="secondary"
        size="lg"
        @click="showStatusModal = false"
      >
        Annuler
      </Button>
      <Button
        :variant="newStatus === 'cancelled' ? 'danger' : 'primary'"
        size="lg"
        :loading="saving"
        @click="confirmStatusChange"
      >
        Confirmer
      </Button>
    </template>
  </Modal>
</template>
