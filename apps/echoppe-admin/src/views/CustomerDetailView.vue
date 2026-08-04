<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/lib/api';
import { useToast } from '@/composables/useToast';
import Badge from '@/components/atoms/Badge.vue';
import Button from '@/components/atoms/Button.vue';
import Modal from '@/components/atoms/Modal.vue';
import type { StatusVariant } from '@/types/ui';

// Types inférés depuis Eden
type CustomerDetailResponse = Awaited<ReturnType<ReturnType<typeof api.customers>['get']>>;
type CustomerDetail = NonNullable<CustomerDetailResponse['data']>;

const route = useRoute();
const router = useRouter();
const toast = useToast();

const customer = ref<CustomerDetail | null>(null);
const loading = ref(true);
const saving = ref(false);

// Modals
const showStatusModal = ref(false);
const showDeleteModal = ref(false);
const newStatus = ref(true);

const customerId = computed(() => route.params.id as string);

async function loadCustomer() {
  loading.value = true;
  try {
    const { data } = await api.customers({ id: customerId.value }).get();
    if (data) {
      customer.value = data;
    }
  } catch {
    toast.error('Erreur lors du chargement du client');
    router.push('/clients');
  } finally {
    loading.value = false;
  }
}

onMounted(loadCustomer);

function formatDate(date: Date | string | null) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

function formatDateTime(date: Date | string | null) {
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

function getStatusConfig(emailVerified: boolean): { label: string; variant: StatusVariant } {
  return emailVerified
    ? { label: 'Actif', variant: 'success' }
    : { label: 'Inactif', variant: 'default' };
}

function getOrderStatusConfig(status: string): { label: string; variant: StatusVariant } {
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

function getAddressTypeLabel(type: string) {
  return type === 'billing' ? 'Facturation' : 'Livraison';
}

function openStatusModal() {
  if (!customer.value) return;
  newStatus.value = !customer.value.emailVerified;
  showStatusModal.value = true;
}

async function confirmStatusChange() {
  if (!customer.value) return;

  saving.value = true;
  try {
    const { error } = await api.customers({ id: customerId.value }).status.patch({
      isActive: newStatus.value,
    });
    if (error) {
      toast.error('Erreur lors de la mise à jour');
      return;
    }
    toast.success(newStatus.value ? 'Client activé' : 'Client désactivé');
    showStatusModal.value = false;
    await loadCustomer();
  } catch {
    toast.error('Erreur lors de la mise à jour');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete() {
  saving.value = true;
  try {
    const { error } = await api.customers({ id: customerId.value }).delete();
    if (error) {
      toast.error('Erreur lors de la suppression');
      return;
    }
    toast.success('Client anonymisé (RGPD)');
    router.push('/clients');
  } catch {
    toast.error('Erreur lors de la suppression');
  } finally {
    saving.value = false;
  }
}

function goToOrder(orderId: string) {
  router.push(`/commandes/${orderId}`);
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
    v-else-if="customer"
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
            @click="router.push('/clients')"
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
            <h1 class="text-2xl font-bold text-gray-900">
              {{ customer.firstName }} {{ customer.lastName }}
            </h1>
            <p class="text-sm text-gray-500">
              {{ customer.email }}
            </p>
          </div>
        </div>
        <Badge :variant="getStatusConfig(customer.emailVerified).variant">
          {{ getStatusConfig(customer.emailVerified).label }}
        </Badge>
      </div>

      <!-- Customer Info -->
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">
          Informations
        </h2>
        <dl class="grid grid-cols-2 gap-4">
          <div>
            <dt class="text-sm text-gray-500">
              Email
            </dt>
            <dd class="text-sm font-medium text-gray-900">
              {{ customer.email }}
            </dd>
          </div>
          <div>
            <dt class="text-sm text-gray-500">
              Téléphone
            </dt>
            <dd class="text-sm font-medium text-gray-900">
              {{ customer.phone || '-' }}
            </dd>
          </div>
          <div>
            <dt class="text-sm text-gray-500">
              Email vérifié
            </dt>
            <dd class="text-sm font-medium text-gray-900">
              {{ customer.emailVerified ? 'Oui' : 'Non' }}
            </dd>
          </div>
          <div>
            <dt class="text-sm text-gray-500">
              Marketing
            </dt>
            <dd class="text-sm font-medium text-gray-900">
              {{ customer.marketingOptin ? 'Accepté' : 'Refusé' }}
            </dd>
          </div>
        </dl>
      </div>

      <!-- Addresses -->
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">
          Adresses
        </h2>
        <div
          v-if="customer.addresses.length === 0"
          class="text-sm text-gray-500"
        >
          Aucune adresse enregistrée
        </div>
        <div
          v-else
          class="grid grid-cols-2 gap-4"
        >
          <div
            v-for="addr in customer.addresses"
            :key="addr.id"
            class="border border-gray-200 rounded-lg p-4"
          >
            <div class="flex items-center gap-2 mb-2">
              <Badge
                variant="info"
                size="sm"
              >
                {{ getAddressTypeLabel(addr.type) }}
              </Badge>
              <Badge
                v-if="addr.isDefault"
                variant="success"
                size="sm"
              >
                Par défaut
              </Badge>
              <span
                v-if="addr.label"
                class="text-sm text-gray-500"
              >{{ addr.label }}</span>
            </div>
            <p class="text-sm text-gray-900 font-medium">
              {{ addr.firstName }} {{ addr.lastName }}
            </p>
            <p
              v-if="addr.company"
              class="text-sm text-gray-600"
            >
              {{ addr.company }}
            </p>
            <p class="text-sm text-gray-600">
              {{ addr.street }}
            </p>
            <p
              v-if="addr.street2"
              class="text-sm text-gray-600"
            >
              {{ addr.street2 }}
            </p>
            <p class="text-sm text-gray-600">
              {{ addr.postalCode }} {{ addr.city }}
            </p>
            <p class="text-sm text-gray-600">
              {{ addr.country }}
            </p>
            <p
              v-if="addr.phone"
              class="text-sm text-gray-500 mt-1"
            >
              {{ addr.phone }}
            </p>
          </div>
        </div>
      </div>

      <!-- Recent Orders -->
      <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">
            Commandes récentes
          </h2>
        </div>
        <div
          v-if="customer.recentOrders.length === 0"
          class="p-6 text-sm text-gray-500"
        >
          Aucune commande
        </div>
        <table
          v-else
          class="w-full"
        >
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                N° Commande
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Statut
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr
              v-for="ord in customer.recentOrders"
              :key="ord.id"
              class="hover:bg-gray-50 cursor-pointer"
              @click="goToOrder(ord.id)"
            >
              <td class="px-6 py-4">
                <span class="font-mono font-medium text-gray-900">{{ ord.orderNumber }}</span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">
                {{ formatDate(ord.dateCreated) }}
              </td>
              <td class="px-6 py-4">
                <Badge :variant="getOrderStatusConfig(ord.status).variant">
                  {{ getOrderStatusConfig(ord.status).label }}
                </Badge>
              </td>
              <td class="px-6 py-4 text-right font-medium text-gray-900">
                {{ formatPrice(ord.totalTtc) }}
              </td>
            </tr>
          </tbody>
        </table>
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
          <Button
            :variant="customer.emailVerified ? 'secondary' : 'primary'"
            size="sm"
            class="w-full"
            @click="openStatusModal"
          >
            {{ customer.emailVerified ? 'Désactiver' : 'Activer' }}
          </Button>
          <Button
            variant="danger"
            size="sm"
            class="w-full"
            @click="showDeleteModal = true"
          >
            Anonymiser (RGPD)
          </Button>
        </div>
      </div>

      <!-- Stats -->
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">
          Statistiques
        </h3>
        <dl class="space-y-3">
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">
              Total commandes
            </dt>
            <dd class="text-sm font-medium text-gray-900">
              {{ customer.stats.totalOrders }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">
              Montant total
            </dt>
            <dd class="text-sm font-medium text-gray-900">
              {{ formatPrice(customer.stats.totalSpent) }}
            </dd>
          </div>
        </dl>
      </div>

      <!-- Dates -->
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">
          Dates
        </h3>
        <dl class="space-y-3">
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">
              Inscription
            </dt>
            <dd class="text-sm text-gray-900">
              {{ formatDate(customer.dateCreated) }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">
              Dernière connexion
            </dt>
            <dd class="text-sm text-gray-900">
              {{ formatDateTime(customer.lastLogin) }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">
              Dernière mise à jour
            </dt>
            <dd class="text-sm text-gray-900">
              {{ formatDate(customer.dateUpdated) }}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </div>

  <!-- Status Change Modal -->
  <Modal
    v-if="showStatusModal"
    :title="newStatus ? 'Activer le client' : 'Désactiver le client'"
    size="sm"
    @close="showStatusModal = false"
  >
    <p class="text-gray-600">
      {{ newStatus
        ? 'Voulez-vous activer ce compte client ?'
        : 'Voulez-vous désactiver ce compte client ? Il ne pourra plus se connecter.'
      }}
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
        :variant="newStatus ? 'primary' : 'danger'"
        size="lg"
        :loading="saving"
        @click="confirmStatusChange"
      >
        {{ newStatus ? 'Activer' : 'Désactiver' }}
      </Button>
    </template>
  </Modal>

  <!-- Delete Modal -->
  <Modal
    v-if="showDeleteModal"
    title="Anonymiser le client (RGPD)"
    size="sm"
    @close="showDeleteModal = false"
  >
    <p class="text-gray-600">
      Cette action est irréversible. Les données personnelles du client seront supprimées
      conformément au RGPD. L'historique des commandes sera conservé avec un client anonyme.
    </p>

    <template #footer>
      <Button
        variant="secondary"
        size="lg"
        @click="showDeleteModal = false"
      >
        Annuler
      </Button>
      <Button
        variant="danger"
        size="lg"
        :loading="saving"
        @click="confirmDelete"
      >
        Anonymiser
      </Button>
    </template>
  </Modal>
</template>
