<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '@/lib/api';
import { useToast } from '@/composables/useToast';
import Button from '@/components/atoms/Button.vue';
import Modal from '@/components/atoms/Modal.vue';
import type { ApiItem } from '@/types/api';

type Provider = ApiItem<ReturnType<typeof api.payments.providers.get>>;

const toast = useToast();
const loading = ref(true);
const providers = ref<Provider[]>([]);
const saving = ref(false);

// Modal state
const showModal = ref(false);
const editingProvider = ref<Provider | null>(null);

// Form state
const stripeForm = ref({ secretKey: '', webhookSecret: '' });
const paypalForm = ref({
  clientId: '',
  clientSecret: '',
  webhookId: '',
  mode: 'sandbox' as 'sandbox' | 'live',
});

const apiBaseUrl = computed(() => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:7532';
  return url.replace(/\/$/, '');
});

async function loadProviders() {
  loading.value = true;
  const { data } = await api.payments.providers.get();
  if (data) {
    providers.value = data;
  }
  loading.value = false;
}

onMounted(loadProviders);

function openConfig(provider: Provider) {
  editingProvider.value = provider;
  // Reset forms
  stripeForm.value = { secretKey: '', webhookSecret: '' };
  paypalForm.value = { clientId: '', clientSecret: '', webhookId: '', mode: 'sandbox' };
  showModal.value = true;
}

async function saveConfig() {
  if (!editingProvider.value) return;

  saving.value = true;
  try {
    if (editingProvider.value.id === 'stripe') {
      const { error } = await api.payments.providers.stripe.put(stripeForm.value);
      if (error) {
        toast.error('Erreur lors de la configuration');
        return;
      }
    } else if (editingProvider.value.id === 'paypal') {
      const { error } = await api.payments.providers.paypal.put(paypalForm.value);
      if (error) {
        toast.error('Erreur lors de la configuration');
        return;
      }
    }

    toast.success('Configuration enregistrée');
    showModal.value = false;
    await loadProviders();
  } catch {
    toast.error('Erreur lors de la configuration');
  } finally {
    saving.value = false;
  }
}

function getProviderIcon(id: string) {
  switch (id) {
    case 'stripe':
      return 'M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z';
    case 'paypal':
      return 'M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z';
    default:
      return '';
  }
}

function copyWebhookUrl(provider: string) {
  const url = `${apiBaseUrl.value}/payments/webhook/${provider}`;
  navigator.clipboard.writeText(url);
  toast.success('URL copiée');
}
</script>

<template>
  <div>
    <!-- Encryption warning -->
    <div
      v-if="providers.length > 0 && !providers[0].encryptionReady"
      class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
    >
      <p class="text-sm text-red-800 font-medium">
        Clé de chiffrement manquante
      </p>
      <p class="text-sm text-red-700 mt-1">
        La variable <code class="bg-red-100 px-1 py-0.5 rounded">ENCRYPTION_KEY</code> n'est pas configurée.
        Les credentials ne peuvent pas être sauvegardés de manière sécurisée.
      </p>
    </div>

    <div
      v-if="loading"
      class="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500"
    >
      Chargement...
    </div>

    <div
      v-else
      class="space-y-4"
    >
      <div
        v-for="provider in providers"
        :key="provider.id"
        class="bg-white rounded-lg border border-gray-200 p-6"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-4">
            <!-- Icon -->
            <div
              :class="[
                'w-12 h-12 rounded-lg flex items-center justify-center',
                provider.isEnabled ? 'bg-gray-900' : 'bg-gray-100'
              ]"
            >
              <svg
                class="w-6 h-6"
                :class="provider.isEnabled ? 'text-white' : 'text-gray-400'"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path :d="getProviderIcon(provider.id)" />
              </svg>
            </div>

            <!-- Info -->
            <div>
              <h3 class="text-lg font-semibold text-gray-900">
                {{ provider.name }}
              </h3>
              <p class="text-sm text-gray-500 mt-0.5">
                {{ provider.description }}
              </p>
            </div>
          </div>

          <!-- Status & Actions -->
          <div class="flex items-center gap-3">
            <span
              :class="[
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
                provider.isEnabled
                  ? 'bg-green-50 text-green-700'
                  : provider.isConfigured
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-gray-100 text-gray-500'
              ]"
            >
              <span
                :class="[
                  'w-2 h-2 rounded-full',
                  provider.isEnabled ? 'bg-green-500' : provider.isConfigured ? 'bg-yellow-500' : 'bg-gray-400'
                ]"
              />
              {{ provider.isEnabled ? 'Actif' : provider.isConfigured ? 'Configuré (inactif)' : 'Non configuré' }}
            </span>

            <Button
              variant="secondary"
              size="sm"
              :disabled="!provider.encryptionReady"
              @click="openConfig(provider)"
            >
              Configurer
            </Button>
          </div>
        </div>

        <!-- Webhook URL (if configured) -->
        <div
          v-if="provider.isConfigured"
          class="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg"
        >
          <p class="text-sm font-medium text-gray-700 mb-2">
            URL du webhook
          </p>
          <div class="flex items-center gap-2">
            <code class="flex-1 text-sm bg-white px-3 py-2 rounded border border-gray-200 text-gray-600 overflow-x-auto">
              {{ apiBaseUrl }}/payments/webhook/{{ provider.id }}
            </code>
            <Button
              variant="secondary"
              size="sm"
              @click="copyWebhookUrl(provider.id)"
            >
              Copier
            </Button>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            <template v-if="provider.id === 'stripe'">
              Ajoutez cette URL dans
              <a
                href="https://dashboard.stripe.com/webhooks"
                target="_blank"
                class="text-blue-600 hover:underline"
              >Stripe Dashboard → Webhooks</a>
            </template>
            <template v-else-if="provider.id === 'paypal'">
              Ajoutez cette URL dans
              <a
                href="https://developer.paypal.com/dashboard/applications"
                target="_blank"
                class="text-blue-600 hover:underline"
              >PayPal Developer → Webhooks</a>
            </template>
          </p>
        </div>
      </div>
    </div>

    <!-- Configuration Modal -->
    <Modal
      v-if="showModal && editingProvider"
      :title="`Configurer ${editingProvider.name}`"
      size="md"
      @close="showModal = false"
    >
      <div class="space-y-6">
        <!-- Stripe Form -->
        <template v-if="editingProvider.id === 'stripe'">
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-800">
              <strong>Étape 1 :</strong> Créez un compte Stripe ou connectez-vous
            </p>
            <a
              href="https://dashboard.stripe.com/register"
              target="_blank"
              class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
            >
              Créer un compte Stripe
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>

          <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-800">
              <strong>Étape 2 :</strong> Récupérez vos clés API
            </p>
            <a
              href="https://dashboard.stripe.com/apikeys"
              target="_blank"
              class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
            >
              Ouvrir les clés API Stripe
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Clé secrète
            </label>
            <input
              v-model="stripeForm.secretKey"
              type="password"
              placeholder="sk_live_..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p class="text-xs text-gray-500 mt-1">
              Commence par sk_live_ (production) ou sk_test_ (test)
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Secret du webhook
            </label>
            <input
              v-model="stripeForm.webhookSecret"
              type="password"
              placeholder="whsec_..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p class="text-xs text-gray-500 mt-1">
              Créez un webhook dans Stripe et copiez le secret ici
            </p>
          </div>
        </template>

        <!-- PayPal Form -->
        <template v-else-if="editingProvider.id === 'paypal'">
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-800">
              <strong>Étape 1 :</strong> Créez une application PayPal
            </p>
            <a
              href="https://developer.paypal.com/dashboard/applications/live"
              target="_blank"
              class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
            >
              Ouvrir PayPal Developer
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Client ID
            </label>
            <input
              v-model="paypalForm.clientId"
              type="text"
              placeholder="AX..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Client Secret
            </label>
            <input
              v-model="paypalForm.clientSecret"
              type="password"
              placeholder="EL..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Webhook ID
            </label>
            <input
              v-model="paypalForm.webhookId"
              type="text"
              placeholder="WH-..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Mode
            </label>
            <select
              v-model="paypalForm.mode"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="sandbox">
                Sandbox (test)
              </option>
              <option value="live">
                Live (production)
              </option>
            </select>
          </div>
        </template>
      </div>

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
          @click="saveConfig"
        >
          Enregistrer
        </Button>
      </template>
    </Modal>
  </div>
</template>
