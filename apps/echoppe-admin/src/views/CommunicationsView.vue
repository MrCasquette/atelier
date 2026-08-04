<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '@/lib/api';
import { useToast } from '@/composables/useToast';
import Button from '@/components/atoms/Button.vue';
import Modal from '@/components/atoms/Modal.vue';
import type { ApiItem } from '@/types/api';

type Provider = ApiItem<ReturnType<typeof api.communications.providers.get>>;

const toast = useToast();
const loading = ref(true);
const providers = ref<Provider[]>([]);
const saving = ref(false);
const testing = ref(false);

// Modal state
const showModal = ref(false);
const editingProvider = ref<Provider | null>(null);

// Form states
const resendForm = ref({
  apiKey: '',
  fromEmail: '',
  fromName: '',
  replyTo: '',
});

const brevoForm = ref({
  apiKey: '',
  fromEmail: '',
  fromName: '',
  replyTo: '',
});

const smtpForm = ref({
  host: '',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  fromEmail: '',
  fromName: '',
  replyTo: '',
});

// Test email
const testEmail = ref('');

async function loadProviders() {
  loading.value = true;
  const { data } = await api.communications.providers.get();
  if (data) {
    providers.value = data;
  }
  loading.value = false;
}

onMounted(loadProviders);

function openConfig(provider: Provider) {
  editingProvider.value = provider;
  // Reset forms
  resendForm.value = { apiKey: '', fromEmail: '', fromName: '', replyTo: '' };
  brevoForm.value = { apiKey: '', fromEmail: '', fromName: '', replyTo: '' };
  smtpForm.value = { host: '', port: 587, secure: false, user: '', pass: '', fromEmail: '', fromName: '', replyTo: '' };
  testEmail.value = '';
  showModal.value = true;
}

async function saveConfig() {
  if (!editingProvider.value) return;

  saving.value = true;
  try {
    if (editingProvider.value.id === 'resend') {
      const { error } = await api.communications.providers.resend.put({
        apiKey: resendForm.value.apiKey,
        fromEmail: resendForm.value.fromEmail,
        fromName: resendForm.value.fromName,
        replyTo: resendForm.value.replyTo || undefined,
        isEnabled: true,
      });
      if (error) {
        toast.error('Erreur lors de la configuration');
        return;
      }
    } else if (editingProvider.value.id === 'brevo') {
      const { error } = await api.communications.providers.brevo.put({
        apiKey: brevoForm.value.apiKey,
        fromEmail: brevoForm.value.fromEmail,
        fromName: brevoForm.value.fromName,
        replyTo: brevoForm.value.replyTo || undefined,
        isEnabled: true,
      });
      if (error) {
        toast.error('Erreur lors de la configuration');
        return;
      }
    } else if (editingProvider.value.id === 'smtp') {
      const { error } = await api.communications.providers.smtp.put({
        host: smtpForm.value.host,
        port: smtpForm.value.port,
        secure: smtpForm.value.secure,
        user: smtpForm.value.user,
        pass: smtpForm.value.pass,
        fromEmail: smtpForm.value.fromEmail,
        fromName: smtpForm.value.fromName,
        replyTo: smtpForm.value.replyTo || undefined,
        isEnabled: true,
      });
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

async function sendTestEmail() {
  if (!editingProvider.value || !testEmail.value) return;

  testing.value = true;
  try {
    const { data, error } = await api.communications.test.post({
      provider: editingProvider.value.id as 'resend' | 'brevo' | 'smtp',
      to: testEmail.value,
    });

    if (error || !data?.success) {
      toast.error(data?.error || 'Erreur lors de l\'envoi du test');
      return;
    }

    toast.success('Email de test envoyé !');
  } catch {
    toast.error('Erreur lors de l\'envoi du test');
  } finally {
    testing.value = false;
  }
}

function getProviderIcon(id: string) {
  switch (id) {
    case 'resend':
      return 'M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884zM18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z';
    case 'brevo':
      return 'M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884zM18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z';
    case 'smtp':
      return 'M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z';
    default:
      return '';
  }
}

const isFormValid = computed(() => {
  if (!editingProvider.value) return false;

  switch (editingProvider.value.id) {
    case 'resend':
      return resendForm.value.apiKey && resendForm.value.fromEmail && resendForm.value.fromName;
    case 'brevo':
      return brevoForm.value.apiKey && brevoForm.value.fromEmail && brevoForm.value.fromName;
    case 'smtp':
      return (
        smtpForm.value.host &&
        smtpForm.value.port &&
        smtpForm.value.user &&
        smtpForm.value.pass &&
        smtpForm.value.fromEmail &&
        smtpForm.value.fromName
      );
    default:
      return false;
  }
});
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
                provider.isEnabled ? 'bg-gray-900' : 'bg-gray-100',
              ]"
            >
              <svg
                class="w-6 h-6"
                :class="provider.isEnabled ? 'text-white' : 'text-gray-400'"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path :d="getProviderIcon(provider.id)" />
              </svg>
            </div>

            <!-- Info -->
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-semibold text-gray-900">
                  {{ provider.name }}
                </h3>
                <span
                  v-if="provider.recommended"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
                >
                  Recommandé
                </span>
              </div>
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
                    : 'bg-gray-100 text-gray-500',
              ]"
            >
              <span
                :class="[
                  'w-2 h-2 rounded-full',
                  provider.isEnabled ? 'bg-green-500' : provider.isConfigured ? 'bg-yellow-500' : 'bg-gray-400',
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
        <!-- Resend Form -->
        <template v-if="editingProvider.id === 'resend'">
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-800">
              <strong>Étape 1 :</strong> Créez un compte Resend
            </p>
            <a
              href="https://resend.com/signup"
              target="_blank"
              class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
            >
              Créer un compte Resend
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
              <strong>Étape 2 :</strong> Ajoutez et vérifiez votre domaine, puis créez une clé API
            </p>
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
            >
              Gérer les clés API
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
              Clé API
            </label>
            <input
              v-model="resendForm.apiKey"
              type="password"
              placeholder="re_..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Email expéditeur
              </label>
              <input
                v-model="resendForm.fromEmail"
                type="email"
                placeholder="contact@votredomaine.fr"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Nom expéditeur
              </label>
              <input
                v-model="resendForm.fromName"
                type="text"
                placeholder="Ma Boutique"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Email de réponse (optionnel)
            </label>
            <input
              v-model="resendForm.replyTo"
              type="email"
              placeholder="reponse@votredomaine.fr"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </template>

        <!-- Brevo Form -->
        <template v-else-if="editingProvider.id === 'brevo'">
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-800">
              <strong>Étape 1 :</strong> Créez un compte Brevo (gratuit jusqu'à 300 emails/jour)
            </p>
            <a
              href="https://www.brevo.com/fr/inscription/"
              target="_blank"
              class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
            >
              Créer un compte Brevo
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
              <strong>Étape 2 :</strong> Générez une clé API dans les paramètres
            </p>
            <a
              href="https://app.brevo.com/settings/keys/api"
              target="_blank"
              class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
            >
              Gérer les clés API
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
              Clé API
            </label>
            <input
              v-model="brevoForm.apiKey"
              type="password"
              placeholder="xkeysib-..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Email expéditeur
              </label>
              <input
                v-model="brevoForm.fromEmail"
                type="email"
                placeholder="contact@votredomaine.fr"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Nom expéditeur
              </label>
              <input
                v-model="brevoForm.fromName"
                type="text"
                placeholder="Ma Boutique"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Email de réponse (optionnel)
            </label>
            <input
              v-model="brevoForm.replyTo"
              type="email"
              placeholder="reponse@votredomaine.fr"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </template>

        <!-- SMTP Form -->
        <template v-else-if="editingProvider.id === 'smtp'">
          <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p class="text-sm text-yellow-800">
              <strong>Note :</strong> Assurez-vous que votre hébergeur a configuré SPF et DKIM pour garantir une bonne
              délivrabilité.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Serveur SMTP
              </label>
              <input
                v-model="smtpForm.host"
                type="text"
                placeholder="ssl0.ovh.net"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Port
              </label>
              <select
                v-model="smtpForm.port"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option :value="465">
                  465 (SSL)
                </option>
                <option :value="587">
                  587 (TLS)
                </option>
                <option :value="25">
                  25 (non sécurisé)
                </option>
              </select>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <input
              id="smtp-secure"
              v-model="smtpForm.secure"
              type="checkbox"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              for="smtp-secure"
              class="text-sm text-gray-700"
            >
              Connexion sécurisée (SSL/TLS)
            </label>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Identifiant
              </label>
              <input
                v-model="smtpForm.user"
                type="text"
                placeholder="contact@votredomaine.fr"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                v-model="smtpForm.pass"
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <hr class="border-gray-200" />

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Email expéditeur
              </label>
              <input
                v-model="smtpForm.fromEmail"
                type="email"
                placeholder="contact@votredomaine.fr"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Nom expéditeur
              </label>
              <input
                v-model="smtpForm.fromName"
                type="text"
                placeholder="Ma Boutique"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Email de réponse (optionnel)
            </label>
            <input
              v-model="smtpForm.replyTo"
              type="email"
              placeholder="reponse@votredomaine.fr"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </template>

        <!-- Test Section (shown only if provider is already configured) -->
        <template v-if="editingProvider.isConfigured">
          <hr class="border-gray-200" />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Tester la configuration
            </label>
            <div class="flex gap-2">
              <input
                v-model="testEmail"
                type="email"
                placeholder="votre@email.com"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Button
                variant="secondary"
                size="md"
                :loading="testing"
                :disabled="!testEmail"
                @click="sendTestEmail"
              >
                Envoyer un test
              </Button>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              Un email de bienvenue sera envoyé à cette adresse
            </p>
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
          :disabled="!isFormValid"
          @click="saveConfig"
        >
          Enregistrer
        </Button>
      </template>
    </Modal>
  </div>
</template>
