<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/lib/api';
import { useToast } from '@/composables/useToast';
import Button from '@/components/atoms/Button.vue';
import Modal from '@/components/atoms/Modal.vue';
import type { ApiItem } from '@/types/api';

type Provider = ApiItem<ReturnType<typeof api.shipping.providers.get>>;

const toast = useToast();
const loading = ref(true);
const providers = ref<Provider[]>([]);
const saving = ref(false);

// Modal state
const showModal = ref(false);
const editingProvider = ref<Provider | null>(null);

// Form state
const colissimoForm = ref({ contractNumber: '', password: '' });
const mondialrelayForm = ref({ brandId: '', login: '', password: '' });
const sendcloudForm = ref({ apiKey: '', apiSecret: '' });

async function loadProviders() {
  loading.value = true;
  const { data } = await api.shipping.providers.get();
  if (data) {
    providers.value = data;
  }
  loading.value = false;
}

onMounted(loadProviders);

function openConfig(provider: Provider) {
  editingProvider.value = provider;
  // Reset forms
  colissimoForm.value = { contractNumber: '', password: '' };
  mondialrelayForm.value = { brandId: '', login: '', password: '' };
  sendcloudForm.value = { apiKey: '', apiSecret: '' };
  showModal.value = true;
}

async function saveConfig() {
  if (!editingProvider.value) return;

  saving.value = true;
  try {
    if (editingProvider.value.id === 'colissimo') {
      const { error } = await api.shipping.providers.colissimo.put(colissimoForm.value);
      if (error) {
        toast.error('Erreur lors de la configuration');
        return;
      }
    } else if (editingProvider.value.id === 'mondialrelay') {
      const { error } = await api.shipping.providers.mondialrelay.put(mondialrelayForm.value);
      if (error) {
        toast.error('Erreur lors de la configuration');
        return;
      }
    } else if (editingProvider.value.id === 'sendcloud') {
      const { error } = await api.shipping.providers.sendcloud.put(sendcloudForm.value);
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
    case 'colissimo':
      return 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';
    case 'mondialrelay':
      return 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';
    case 'sendcloud':
      return 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z';
    default:
      return '';
  }
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
        <!-- Colissimo Form -->
        <template v-if="editingProvider.id === 'colissimo'">
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-800">
              <strong>Étape 1 :</strong> Ouvrez un compte professionnel Colissimo
            </p>
            <a
              href="https://www.colissimo.entreprise.laposte.fr/"
              target="_blank"
              class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
            >
              Ouvrir Colissimo Entreprise
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
              Numéro de contrat
            </label>
            <input
              v-model="colissimoForm.contractNumber"
              type="text"
              placeholder="123456"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <input
              v-model="colissimoForm.password"
              type="password"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </template>

        <!-- Mondial Relay Form -->
        <template v-else-if="editingProvider.id === 'mondialrelay'">
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-800">
              <strong>Étape 1 :</strong> Créez un compte professionnel Mondial Relay
            </p>
            <a
              href="https://www.mondialrelay.fr/envoi-de-colis/expedier-des-colis/ouvrir-un-compte-professionnel/"
              target="_blank"
              class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
            >
              Ouvrir un compte Mondial Relay
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
              Code Enseigne
            </label>
            <input
              v-model="mondialrelayForm.brandId"
              type="text"
              placeholder="BDTEST"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p class="text-xs text-gray-500 mt-1">
              Fourni par Mondial Relay lors de l'ouverture du compte
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Login
            </label>
            <input
              v-model="mondialrelayForm.login"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <input
              v-model="mondialrelayForm.password"
              type="password"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </template>

        <!-- Sendcloud Form -->
        <template v-else-if="editingProvider.id === 'sendcloud'">
          <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p class="text-sm text-green-800 font-medium">
              Recommandé
            </p>
            <p class="text-sm text-green-700 mt-1">
              Sendcloud permet d'accéder à plusieurs transporteurs (Colissimo, DHL, UPS, Mondial Relay...)
              avec une seule intégration.
            </p>
          </div>

          <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-800">
              <strong>Étape 1 :</strong> Créez un compte Sendcloud
            </p>
            <a
              href="https://www.sendcloud.fr/"
              target="_blank"
              class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
            >
              Créer un compte Sendcloud
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
              href="https://app.sendcloud.com/v2/settings/integrations/api"
              target="_blank"
              class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
            >
              Ouvrir Sendcloud → Intégrations → API
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
              API Key
            </label>
            <input
              v-model="sendcloudForm.apiKey"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              API Secret
            </label>
            <input
              v-model="sendcloudForm.apiSecret"
              type="password"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
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
