<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  useRoles,
  type RoleWithPermissions,
  type RoleFormData,
  type PermissionFormData,
} from '@/composables/roles';
import { useToast } from '@/composables/useToast';
import Button from '@/components/atoms/Button.vue';
import PermissionMatrix from '@/components/organisms/PermissionMatrix.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const {
  saving,
  loadRoleWithPermissions,
  createRole,
  updateRole,
  updatePermissions,
} = useRoles();

const loading = ref(true);
const role = ref<RoleWithPermissions | null>(null);
const permissions = ref<PermissionFormData[]>([]);

const form = ref<RoleFormData>({
  name: '',
  description: null,
  scope: 'admin',
});

const isNew = computed(() => !route.params.id);
const isSystem = computed(() => role.value?.isSystem ?? false);
const pageTitle = computed(() => {
  if (isNew.value) return 'Nouveau role';
  return role.value?.name || 'Role';
});

onMounted(async () => {
  if (!isNew.value) {
    const id = route.params.id as string;
    const data = await loadRoleWithPermissions(id);
    if (data) {
      role.value = data;
      form.value = {
        name: data.name,
        description: data.description,
        scope: data.scope,
      };
      permissions.value = data.permissions.map((p) => ({
        resource: p.resource,
        canCreate: p.canCreate,
        canRead: p.canRead,
        canUpdate: p.canUpdate,
        canDelete: p.canDelete,
        selfOnly: p.selfOnly,
        locked: p.locked,
      }));
    } else {
      toast.error('Role non trouve');
      router.push({ name: 'roles' });
      return;
    }
  }
  loading.value = false;
});

async function save() {
  if (isNew.value) {
    const created = await createRole(form.value);
    if (created) {
      // Sauvegarder les permissions
      if (permissions.value.length > 0) {
        await updatePermissions(created.id, permissions.value);
      }
      toast.success('Role cree');
      router.push({ name: 'roles' });
    } else {
      toast.error('Erreur lors de la creation');
    }
  } else {
    const id = route.params.id as string;

    // Mettre a jour le role (sauf si systeme)
    if (!isSystem.value) {
      const success = await updateRole(id, form.value);
      if (!success) {
        toast.error('Erreur lors de la mise a jour');
        return;
      }
    }

    // Mettre a jour les permissions
    const permSuccess = await updatePermissions(id, permissions.value);
    if (permSuccess) {
      toast.success('Role mis a jour');
      router.push({ name: 'roles' });
    } else {
      toast.error('Erreur lors de la mise a jour des permissions');
    }
  }
}

function cancel() {
  router.push({ name: 'roles' });
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
        Retour aux roles
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
        <h2 class="text-lg font-semibold mb-4">
          {{ pageTitle }}
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              v-model="form.name"
              type="text"
              required
              :disabled="isSystem"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <select
              v-model="form.scope"
              :disabled="isSystem"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="admin">
                Admin
              </option>
              <option value="store">
                Boutique
              </option>
            </select>
          </div>

          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              v-model="form.description"
              rows="2"
              :disabled="isSystem"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div
          v-if="isSystem"
          class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800"
        >
          Les roles systeme ne peuvent pas etre renommes ou supprimes. Vous pouvez uniquement modifier leurs permissions.
        </div>
      </div>

      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-4">
          Permissions
        </h3>
        <PermissionMatrix
          :permissions="permissions"
          :show-self-only="form.scope === 'store'"
          @update:permissions="permissions = $event"
        />
      </div>

      <div class="flex justify-end gap-3">
        <Button
          variant="secondary"
          size="lg"
          @click="cancel"
        >
          Annuler
        </Button>
        <Button
          variant="primary"
          size="lg"
          :loading="saving"
          @click="save"
        >
          {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
        </Button>
      </div>
    </div>
  </div>
</template>
