<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/lib/api';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import Button from '@/components/atoms/Button.vue';
import Badge from '@/components/atoms/Badge.vue';
import type { ApiData } from '@/types/api';

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

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { user: currentUser } = useAuth();

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
    const id = route.params.id as string;
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

  if (isNew.value && !form.value.password) {
    toast.error('Le mot de passe est obligatoire');
    return;
  }

  if (form.value.password && form.value.password.length < 6) {
    toast.error('Le mot de passe doit contenir au moins 6 caractères');
    return;
  }

  saving.value = true;
  try {
    if (isNew.value) {
      // Create user
      const { error } = await api.users.post({
        email: form.value.email,
        password: form.value.password,
        firstName: form.value.firstName,
        lastName: form.value.lastName,
        role: form.value.role,
      });

      if (error) {
        toast.error(error.value?.message || 'Erreur lors de la création');
        return;
      }

      toast.success('Utilisateur créé');
      router.push('/utilisateurs');
    } else {
      // Update user
      const id = route.params.id as string;
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
        toast.error(error.value?.message || 'Erreur lors de la mise à jour');
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
            Owner
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

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
                <span
                  v-if="isNew"
                  class="text-red-500"
                >*</span>
                <span
                  v-else
                  class="text-gray-400 text-xs"
                >(laisser vide pour ne pas modifier)</span>
              </label>
              <input
                v-model="form.password"
                type="password"
                :required="isNew"
                :disabled="isLocked"
                minlength="6"
                placeholder="••••••"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
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
    </div>
  </div>
</template>
