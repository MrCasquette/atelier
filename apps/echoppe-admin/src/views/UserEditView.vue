<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import Button from '@/components/atoms/Button.vue';
import Badge from '@/components/atoms/Badge.vue';
import ConfirmModal from '@/components/atoms/ConfirmModal.vue';
import type { ApiData } from '@/types/api';
import { param } from '@/lib/route';

// Types inférés depuis Eden
type UserDetailResponse = Awaited<ReturnType<ReturnType<typeof api.users>['get']>>;
type UserDetail = NonNullable<UserDetailResponse['data']>;

type RolesResponse = ApiData<ReturnType<typeof api.roles.get>>;
type Role = RolesResponse[number];

interface UserForm {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
}

/** Le lien de pose de mot de passe, quand aucun fournisseur d'envoi n'est configuré (ADR-0048). */
type Invitation = NonNullable<
  NonNullable<Awaited<ReturnType<typeof api.users.post>>['data']>['invitation']
>;

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { user: currentUser, isOwner: viewerIsOwner, checkAuth } = useAuth();

const loading = ref(true);
const saving = ref(false);
const user = ref<UserDetail | null>(null);
const roles = ref<Role[]>([]);

const form = ref<UserForm>({
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: '',
});

const isNew = computed(() => route.name === 'user-create');
const isOwner = computed(() => user.value?.isOwner ?? false);
// L'owner peut se modifier lui-même ; seul un AUTRE utilisateur est verrouillé (cf. users.ts).
const isSelf = computed(() => !!currentUser.value && currentUser.value.id === user.value?.id);
const isLocked = computed(() => isOwner.value && !isSelf.value);

// Transférer la propriété : seul le propriétaire le peut, et seulement vers quelqu'un d'autre, qui
// peut se connecter (ADR-0047, décision 6).
const canTransfer = computed(
  () => viewerIsOwner.value && !isNew.value && !isOwner.value && (user.value?.isActive ?? false),
);
const transferOpen = ref(false);
const transferring = ref(false);

// Le mot de passe ne se pose que sur SOI (ADR-0048) : le champ disparaît pour tout autre compte,
// et le déblocage passe par un lien que le destinataire est seul à suivre.
const canSetOwnPassword = computed(() => !isNew.value && isSelf.value);
const canSendLink = computed(() => !isNew.value && !isSelf.value && !isLocked.value);

const invitation = ref<Invitation | null>(null);
const sendingLink = ref(false);
const linkCopied = ref(false);

async function copyLink() {
  if (!invitation.value) return;
  await navigator.clipboard.writeText(invitation.value.url);
  linkCopied.value = true;
  setTimeout(() => {
    linkCopied.value = false;
  }, 2000);
}

async function sendResetLink() {
  const id = user.value?.id;
  if (!id) return;

  sendingLink.value = true;
  const { data, error } = await api.users({ id }).reset.post();
  sendingLink.value = false;

  if (error) {
    toast.error(errorMessage(error, 'Envoi impossible'));
    return;
  }

  // Le lien ne revient QUE faute de fournisseur : sinon il est déjà parti, et personne d'autre que
  // le destinataire ne l'aura vu.
  if (data?.invitation) {
    invitation.value = data.invitation;
    toast.success('Lien à transmettre — aucun fournisseur d’envoi configuré');
  } else {
    toast.success('Lien envoyé par courriel');
  }
}

async function confirmTransfer() {
  const id = user.value?.id;
  if (!id) return;

  transferring.value = true;
  const { error } = await api.users({ id }).ownership.post({});
  transferring.value = false;
  transferOpen.value = false;

  if (error) {
    toast.error('Le transfert a échoué');
    return;
  }

  toast.success('Propriété transférée');
  // L'appelant vient de perdre son autorité : le contexte local mentirait jusqu'au rechargement.
  await checkAuth();
  router.push('/utilisateurs');
}
const pageTitle = computed(() => {
  if (isNew.value) return 'Nouvel utilisateur';
  return user.value ? `${user.value.firstName} ${user.value.lastName}` : 'Utilisateur';
});

async function loadRoles() {
  try {
    const { data } = await api.roles.get();
    if (data) {
      // Filter to only admin roles
      roles.value = data.filter((r: Role) => r.scope === 'admin');
    }
  } catch {
    toast.error('Erreur lors du chargement des rôles');
  }
}

async function loadUser() {
  if (isNew.value) {
    loading.value = false;
    return;
  }

  try {
    const id = param(route.params.id);
    if (!id) return;
    const { data } = await api.users({ id }).get();
    if (data) {
      user.value = data;
      form.value = {
        email: data.email,
        password: '', // Don't show password
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role.id,
      };
    } else {
      toast.error('Utilisateur non trouvé');
      router.push('/utilisateurs');
    }
  } catch {
    toast.error('Erreur lors du chargement');
    router.push('/utilisateurs');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadRoles();
  await loadUser();
});

async function save() {
  // Validation
  if (!form.value.email || !form.value.firstName || !form.value.lastName || !form.value.role) {
    toast.error('Veuillez remplir tous les champs obligatoires');
    return;
  }

  if (form.value.password && form.value.password.length < 6) {
    toast.error('Le mot de passe doit contenir au moins 6 caractères');
    return;
  }

  saving.value = true;
  try {
    if (isNew.value) {
      // Aucun mot de passe : l'invité pose le sien (ADR-0048).
      const { data, error } = await api.users.post({
        email: form.value.email,
        firstName: form.value.firstName,
        lastName: form.value.lastName,
        role: form.value.role,
      });

      if (error) {
        toast.error(errorMessage(error, 'Erreur lors de la création'));
        return;
      }

      // Sans fournisseur d'envoi, le lien revient ici : on RESTE sur l'écran pour le montrer, sinon
      // il serait perdu et le compte resterait inutilisable.
      if (data?.invitation) {
        invitation.value = data.invitation;
        toast.success('Utilisateur créé — transmettez-lui le lien');
        return;
      }

      toast.success('Utilisateur créé, invitation envoyée');
      router.push('/utilisateurs');
    } else {
      // Update user
      const id = param(route.params.id);
    if (!id) return;
      const updates: Record<string, string> = {
        email: form.value.email,
        firstName: form.value.firstName,
        lastName: form.value.lastName,
        role: form.value.role,
      };

      // Only include password if provided
      if (form.value.password) {
        updates.password = form.value.password;
      }

      const { error } = await api.users({ id }).patch(updates);

      if (error) {
        toast.error(errorMessage(error, 'Erreur lors de la mise à jour'));
        return;
      }

      toast.success('Utilisateur mis à jour');
      router.push('/utilisateurs');
    }
  } catch {
    toast.error('Erreur lors de l\'enregistrement');
  } finally {
    saving.value = false;
  }
}

function cancel() {
  router.push('/utilisateurs');
}
</script>

<template>
  <div>
    <div class="mb-6">
      <button
        class="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
        @click="cancel"
      >
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Retour aux utilisateurs
      </button>
    </div>

    <div
      v-if="loading"
      class="text-gray-500"
    >
      Chargement...
    </div>

    <div v-else>
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold">
            {{ pageTitle }}
          </h2>
          <Badge
            v-if="isOwner"
            variant="warning"
          >
            Propriétaire
          </Badge>
        </div>

        <div
          v-if="isLocked"
          class="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800"
        >
          Le propriétaire ne peut pas être modifié par d'autres utilisateurs.
        </div>

        <form @submit.prevent="save">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Prénom <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.firstName"
                type="text"
                required
                :disabled="isLocked"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Nom <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.lastName"
                type="text"
                required
                :disabled="isLocked"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Email <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.email"
                type="email"
                required
                :disabled="isLocked"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div v-if="canSetOwnPassword">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
                <span class="text-gray-400 text-xs">(laisser vide pour ne pas modifier)</span>
              </label>
              <input
                v-model="form.password"
                type="password"
                minlength="6"
                placeholder="••••••"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div
              v-else
              class="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-600"
            >
              <p class="font-medium text-gray-800">
                Vous ne choisissez pas son mot de passe
              </p>
              <p class="mt-1">
                <template v-if="isNew">
                  Il le posera lui-même en suivant le lien d'invitation.
                </template>
                <template v-else>
                  Envoyez-lui un lien de réinitialisation pour le débloquer.
                </template>
              </p>
            </div>

            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Rôle <span class="text-red-500">*</span>
              </label>
              <select
                v-model="form.role"
                required
                :disabled="isLocked"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option
                  value=""
                  disabled
                >
                  Sélectionner un rôle
                </option>
                <option
                  v-for="role in roles"
                  :key="role.id"
                  :value="role.id"
                >
                  {{ role.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              @click="cancel"
            >
              Annuler
            </Button>
            <Button
              v-if="!isLocked"
              type="submit"
              variant="primary"
              size="lg"
              :loading="saving"
            >
              {{ saving ? 'Enregistrement...' : (isNew ? 'Créer' : 'Enregistrer') }}
            </Button>
          </div>
        </form>
      </div>

      <div
        v-if="invitation"
        class="bg-white rounded-lg shadow p-6 mb-6 border border-blue-200"
      >
        <h3 class="text-base font-semibold text-gray-900">
          Lien à transmettre
        </h3>
        <p class="mt-2 max-w-2xl text-sm text-gray-600">
          Aucun fournisseur d'envoi n'est configuré : ce lien ne partira pas tout seul. Transmettez-le
          par vos moyens — il expire, et ne fonctionne qu'une fois.
        </p>
        <div class="mt-3 flex items-center gap-2">
          <input
            :value="invitation.url"
            readonly
            class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-xs"
          />
          <Button
            variant="secondary"
            @click="copyLink"
          >
            {{ linkCopied ? 'Copié' : 'Copier' }}
          </Button>
        </div>
        <p class="mt-2 text-xs text-gray-500">
          Expire le {{ new Date(invitation.expiresAt).toLocaleString('fr-FR') }}.
        </p>
      </div>

      <div
        v-if="canSendLink"
        class="bg-white rounded-lg shadow p-6 mb-6"
      >
        <h3 class="text-base font-semibold text-gray-900">
          Débloquer ce compte
        </h3>
        <p class="mt-2 max-w-2xl text-sm text-gray-600">
          Envoie un lien permettant à {{ user?.firstName }} de choisir un nouveau mot de passe. Vous
          ne le connaîtrez pas, et ses sessions ouvertes seront fermées.
        </p>
        <Button
          class="mt-4"
          variant="secondary"
          :loading="sendingLink"
          @click="sendResetLink"
        >
          Envoyer un lien de réinitialisation
        </Button>
      </div>

      <div
        v-if="canTransfer"
        class="bg-white rounded-lg shadow p-6 border border-red-200"
      >
        <h3 class="text-base font-semibold text-gray-900">
          Transférer la propriété
        </h3>
        <p class="mt-2 max-w-2xl text-sm text-gray-600">
          {{ user?.firstName }} deviendra le propriétaire de l'installation, et vous redeviendrez un
          administrateur ordinaire — vous perdrez l'accès aux identifiants de paiement et d'envoi.
        </p>
        <p class="mt-2 max-w-2xl text-sm font-medium text-red-700">
          Vous ne pourrez pas reprendre la propriété vous-même. Seul le nouveau propriétaire pourra
          vous la rendre.
        </p>
        <Button
          class="mt-4"
          variant="danger"
          :loading="transferring"
          @click="transferOpen = true"
        >
          Transférer la propriété
        </Button>
      </div>
    </div>

    <ConfirmModal
      :open="transferOpen"
      title="Transférer la propriété"
      :message="`Transférer la propriété de l'installation à ${user?.firstName} ${user?.lastName} ? Vous ne pourrez pas la reprendre : seul le nouveau propriétaire pourra vous la rendre.`"
      confirm-label="Transférer"
      @confirm="confirmTransfer"
      @cancel="transferOpen = false"
    />
  </div>
</template>
