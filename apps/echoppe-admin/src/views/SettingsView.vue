<script setup lang="ts">
import { ref, computed, onMounted, h, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '@/lib/api';
import { useToast } from '@/composables/useToast';
import { useRoles, type Role } from '@/composables/roles';
import Button from '@/components/atoms/Button.vue';
import Badge from '@/components/atoms/Badge.vue';
import MediaPicker from '@/components/molecules/MediaPicker.vue';
import ConfirmModal from '@/components/atoms/ConfirmModal.vue';
import DataTable from '@/components/organisms/DataTable/DataTable.vue';
import ApiKeysPanel from '@/components/organisms/ApiKeys/ApiKeysPanel.vue';
import Pagination from '@/components/molecules/Pagination.vue';
import FilterText from '@/components/molecules/PageHeader/FilterText.vue';
import FilterSelect from '@/components/molecules/PageHeader/FilterSelect.vue';
import type { DataTableColumn } from '@/components/organisms/DataTable/types';
import type { BatchAction, FilterOption } from '@/components/molecules/PageHeader/types';
import type { StatusVariant } from '@/types/ui';
import type { ApiData, ApiItem } from '@/types/api';

// Types
type Company = ApiData<ReturnType<typeof api.company.get>>;
type Country = ApiItem<ReturnType<typeof api.company.countries.get>>;
type UsersResponse = ApiData<ReturnType<typeof api.users.get>>;
type User = UsersResponse['data'][number];

const router = useRouter();
const route = useRoute();
const toast = useToast();

// Tabs
type TabId = 'info' | 'roles' | 'users' | 'api-keys';
const activeTab = ref<TabId>('info');

const tabs = [
  { id: 'info' as const, label: 'Informations' },
  { id: 'roles' as const, label: 'Rôles & permissions' },
  { id: 'users' as const, label: 'Utilisateurs' },
  { id: 'api-keys' as const, label: "Clés d'API" },
];

// Init tab from URL
onMounted(() => {
  const tab = route.query.tab as string;
  if (tab === 'roles' || tab === 'users' || tab === 'api-keys') {
    activeTab.value = tab;
  }
});

watch(activeTab, (tab) => {
  router.replace({ query: tab === 'info' ? {} : { tab } });
});

// ========== INFORMATIONS ==========
const loading = ref(true);
const saving = ref(false);
const countries = ref<Country[]>([]);
const initialState = ref<string | null>(null);

const legalForms = [
  { value: 'EI', label: 'Entreprise Individuelle (EI)' },
  { value: 'AE', label: 'Auto-Entrepreneur' },
  { value: 'EURL', label: 'EURL' },
  { value: 'SARL', label: 'SARL' },
  { value: 'SASU', label: 'SASU' },
  { value: 'SAS', label: 'SAS' },
  { value: 'SA', label: 'SA' },
  { value: 'SCI', label: 'SCI' },
];

const form = ref({
  shopName: '',
  logo: null as string | null,
  publicEmail: '',
  publicPhone: '',
  legalName: '',
  legalForm: '',
  siren: '',
  siret: '',
  tvaIntra: '',
  rcsCity: '',
  shareCapital: '',
  street: '',
  street2: '',
  postalCode: '',
  city: '',
  country: '',
  documentPrefix: 'REC',
  invoicePrefix: 'FA',
  taxExempt: false,
  publisherName: '',
  hostingProvider: '',
  hostingAddress: '',
  hostingPhone: '',
});

const hasChanges = computed(() => {
  if (!initialState.value) return form.value.shopName.trim() !== '';
  return JSON.stringify(form.value) !== initialState.value;
});

async function loadCompany() {
  loading.value = true;

  const [companyRes, countriesRes] = await Promise.all([
    api.company.get(),
    api.company.countries.get(),
  ]);

  if (countriesRes.data) {
    countries.value = countriesRes.data;
  }

  if (companyRes.data) {
    const c = companyRes.data as Company;
    form.value = {
      shopName: c.shopName,
      logo: c.logo,
      publicEmail: c.publicEmail,
      publicPhone: c.publicPhone ?? '',
      legalName: c.legalName,
      legalForm: c.legalForm ?? '',
      siren: c.siren ?? '',
      siret: c.siret ?? '',
      tvaIntra: c.tvaIntra ?? '',
      rcsCity: c.rcsCity ?? '',
      shareCapital: c.shareCapital ?? '',
      street: c.street,
      street2: c.street2 ?? '',
      postalCode: c.postalCode,
      city: c.city,
      country: c.country,
      documentPrefix: c.documentPrefix,
      invoicePrefix: c.invoicePrefix,
      taxExempt: c.taxExempt,
      publisherName: c.publisherName ?? '',
      hostingProvider: c.hostingProvider ?? '',
      hostingAddress: c.hostingAddress ?? '',
      hostingPhone: c.hostingPhone ?? '',
    };
    initialState.value = JSON.stringify(form.value);
  }

  loading.value = false;
}

onMounted(loadCompany);

async function save() {
  saving.value = true;

  try {
    const payload = {
      shopName: form.value.shopName,
      logo: form.value.logo || null,
      publicEmail: form.value.publicEmail,
      publicPhone: form.value.publicPhone || null,
      legalName: form.value.legalName,
      legalForm: form.value.legalForm || null,
      siren: form.value.siren || null,
      siret: form.value.siret || null,
      tvaIntra: form.value.tvaIntra || null,
      rcsCity: form.value.rcsCity || null,
      shareCapital: form.value.shareCapital || null,
      street: form.value.street,
      street2: form.value.street2 || null,
      postalCode: form.value.postalCode,
      city: form.value.city,
      country: form.value.country,
      documentPrefix: form.value.documentPrefix,
      invoicePrefix: form.value.invoicePrefix,
      taxExempt: form.value.taxExempt,
      publisherName: form.value.publisherName || null,
      hostingProvider: form.value.hostingProvider || null,
      hostingAddress: form.value.hostingAddress || null,
      hostingPhone: form.value.hostingPhone || null,
    };

    const { error } = await api.company.put(payload);

    if (error) {
      toast.error('Erreur lors de la sauvegarde');
    } else {
      toast.success('Paramètres enregistrés');
      initialState.value = JSON.stringify(form.value);
    }
  } catch {
    toast.error('Erreur lors de la sauvegarde');
  } finally {
    saving.value = false;
  }
}

// ========== ROLES ==========
const { roles, loading: rolesLoading, loadRoles, deleteRole } = useRoles();
const deleteRoleModalOpen = ref(false);
const roleToDelete = ref<Role | null>(null);

onMounted(loadRoles);

function editRole(id: string) {
  router.push({ name: 'role-edit', params: { id } });
}

function confirmDeleteRole(role: Role) {
  roleToDelete.value = role;
  deleteRoleModalOpen.value = true;
}

async function handleDeleteRole() {
  if (!roleToDelete.value) return;

  const success = await deleteRole(roleToDelete.value.id);
  if (success) {
    toast.success('Rôle supprimé');
  } else {
    toast.error('Erreur lors de la suppression');
  }

  deleteRoleModalOpen.value = false;
  roleToDelete.value = null;
}

// ========== USERS ==========
const users = ref<User[]>([]);
const usersLoading = ref(false);
const selectedUsers = ref<User[]>([]);
const DEFAULT_LIMIT = 20;

const paginationMeta = ref({
  total: 0,
  page: 1,
  limit: DEFAULT_LIMIT,
  totalPages: 0,
});

const searchFilter = ref('');
const roleFilter = ref('');
const statusFilter = ref('');
const filtersOpen = ref(false);

// Tri serveur. Les id de colonnes correspondent aux clés d'allowlist de l'API.
const sortField = ref('');
const sortOrder = ref<'asc' | 'desc'>('desc');

const showUserDeleteModal = ref(false);
const userToDelete = ref<User | null>(null);
const deletingUser = ref(false);

const statusOptions: FilterOption[] = [
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
];

const roleOptions = computed<FilterOption[]>(() =>
  roles.value
    .filter((r) => r.scope === 'admin')
    .map((r) => ({ value: r.id, label: r.name })),
);

async function loadUsers() {
  usersLoading.value = true;
  try {
    const query: Record<string, string | number> = {
      page: paginationMeta.value.page,
      limit: paginationMeta.value.limit,
    };

    if (searchFilter.value) query.search = searchFilter.value;
    if (roleFilter.value) query.role = roleFilter.value;
    if (statusFilter.value) query.status = statusFilter.value;
    if (sortField.value) {
      query.sort = sortField.value;
      query.order = sortOrder.value;
    }

    const { data } = await api.users.get({ query });
    if (data?.data && data?.meta) {
      users.value = data.data;
      paginationMeta.value = data.meta;
    }
  } catch {
    toast.error('Erreur lors du chargement des utilisateurs');
  } finally {
    usersLoading.value = false;
  }
}

onMounted(loadUsers);

function handleSort(payload: { field: string; order: 'asc' | 'desc' } | null) {
  sortField.value = payload?.field ?? '';
  sortOrder.value = payload?.order ?? 'desc';
  paginationMeta.value.page = 1;
  loadUsers();
}

function setPage(page: number) {
  paginationMeta.value.page = page;
  loadUsers();
}

function applyFilters() {
  paginationMeta.value.page = 1;
  loadUsers();
}

function resetFilters() {
  searchFilter.value = '';
  roleFilter.value = '';
  statusFilter.value = '';
  paginationMeta.value.page = 1;
  loadUsers();
}

function openEditUser(user: User) {
  router.push({ name: 'user-edit', params: { id: user.id } });
}

function createUser() {
  router.push({ name: 'user-create' });
}

function formatDateTime(date: Date | string | null) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function getStatusConfig(isActive: boolean): { label: string; variant: StatusVariant } {
  return isActive
    ? { label: 'Actif', variant: 'success' }
    : { label: 'Inactif', variant: 'default' };
}

const userColumns = computed<DataTableColumn<User>[]>(() => [
  {
    id: 'name',
    label: 'Utilisateur',
    accessorKey: 'firstName',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2' }, [
        h('div', {}, [
          h('div', { class: 'flex items-center gap-2' }, [
            h(
              'p',
              { class: 'font-medium text-gray-900' },
              `${row.original.firstName} ${row.original.lastName}`,
            ),
            row.original.isOwner
              ? h(Badge, { variant: 'warning', size: 'sm' }, () => 'Owner')
              : null,
          ]),
          h('p', { class: 'text-sm text-gray-500' }, row.original.email),
        ]),
      ]),
  },
  {
    id: 'role',
    label: 'Rôle',
    accessorKey: 'role',
    sortable: false,
    cell: ({ row }) =>
      h(Badge, { variant: 'info' }, () => row.original.role.name),
  },
  {
    id: 'status',
    label: 'Statut',
    accessorKey: 'isActive',
    sortable: false,
    cell: ({ row }) => {
      const config = getStatusConfig(row.original.isActive);
      return h(Badge, { variant: config.variant }, () => config.label);
    },
  },
  {
    id: 'lastLogin',
    label: 'Dernière connexion',
    accessorKey: 'lastLogin',
    cell: ({ row }) =>
      h('span', { class: 'text-gray-500 text-sm' }, formatDateTime(row.original.lastLogin)),
  },
]);

const batchActions: BatchAction[] = [
  { id: 'activate', label: 'Activer', icon: 'edit' },
  { id: 'deactivate', label: 'Désactiver', icon: 'archive', variant: 'danger' },
];

function handleSelectionChange(selected: User[]) {
  selectedUsers.value = selected;
}

async function setUsersStatus(isActive: boolean) {
  try {
    let failed = 0;
    for (const u of selectedUsers.value) {
      if (u.isOwner) continue;
      const { error } = await api.users({ id: u.id }).status.patch({ isActive });
      if (error) failed++;
    }
    selectedUsers.value = [];
    await loadUsers();
    if (failed > 0) toast.error(`Échec de la mise à jour de ${failed} utilisateur(s)`);
    else toast.success('Utilisateur(s) mis à jour');
  } catch {
    toast.error('Erreur lors de la mise à jour');
  }
}

function handleBatchAction(actionId: string) {
  if (actionId === 'activate') {
    setUsersStatus(true);
  } else if (actionId === 'deactivate') {
    setUsersStatus(false);
  }
}

async function confirmDeleteUser() {
  if (!userToDelete.value) return;

  deletingUser.value = true;
  try {
    const { error } = await api.users({ id: userToDelete.value.id }).delete();
    if (error) {
      toast.error('Erreur lors de la suppression');
      return;
    }
    toast.success('Utilisateur supprimé');
    showUserDeleteModal.value = false;
    userToDelete.value = null;
    await loadUsers();
  } catch {
    toast.error('Erreur lors de la suppression');
  } finally {
    deletingUser.value = false;
  }
}

const activeFiltersCount = computed(() => {
  let count = 0;
  if (searchFilter.value) count++;
  if (roleFilter.value) count++;
  if (statusFilter.value) count++;
  return count;
});
</script>

<template>
  <div>
    <!-- Header with tabs -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex gap-1 bg-gray-100 p-1 rounded-lg">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="[
            'px-4 py-2 text-sm font-medium rounded-md transition-colors',
            activeTab === tab.id
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Action buttons per tab -->
      <Button
        v-if="activeTab === 'info'"
        variant="primary"
        size="lg"
        :disabled="!hasChanges || saving"
        :loading="saving"
        @click="save"
      >
        Enregistrer
      </Button>
      <Button
        v-else-if="activeTab === 'roles'"
        variant="primary"
        @click="router.push({ name: 'role-new' })"
      >
        Nouveau rôle
      </Button>
      <Button
        v-else-if="activeTab === 'users'"
        variant="primary"
        @click="createUser"
      >
        Nouvel utilisateur
      </Button>
    </div>

    <!-- Tab: Informations -->
    <div v-if="activeTab === 'info'">
      <div
        v-if="loading"
        class="text-gray-500"
      >
        Chargement...
      </div>

      <form
        v-else
        class="space-y-8 max-w-3xl"
        @submit.prevent="save"
      >
        <!-- Section: Informations boutique -->
        <section class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">
            Informations boutique
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Nom de la boutique *</label>
              <input
                v-model="form.shopName"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email public *</label>
              <input
                v-model="form.publicEmail"
                type="email"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Téléphone public</label>
              <input
                v-model="form.publicPhone"
                type="tel"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Logo</label>
              <MediaPicker v-model="form.logo" />
            </div>
          </div>
        </section>

        <!-- Section: Informations légales -->
        <section class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">
            Informations légales
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Raison sociale *</label>
              <input
                v-model="form.legalName"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Forme juridique</label>
              <select
                v-model="form.legalForm"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">
                  Sélectionner...
                </option>
                <option
                  v-for="lf in legalForms"
                  :key="lf.value"
                  :value="lf.value"
                >
                  {{ lf.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">SIREN</label>
              <input
                v-model="form.siren"
                type="text"
                maxlength="9"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">SIRET</label>
              <input
                v-model="form.siret"
                type="text"
                maxlength="14"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">N° TVA Intracommunautaire</label>
              <input
                v-model="form.tvaIntra"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Ville RCS</label>
              <input
                v-model="form.rcsCity"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Capital social</label>
              <input
                v-model="form.shareCapital"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </section>

        <!-- Section: TVA -->
        <section class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">
            TVA
          </h2>
          <div class="flex items-start gap-3">
            <button
              type="button"
              role="switch"
              :aria-checked="form.taxExempt"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              :class="form.taxExempt ? 'bg-blue-600' : 'bg-gray-200'"
              @click="form.taxExempt = !form.taxExempt"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                :class="form.taxExempt ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
            <div>
              <p class="text-sm font-medium text-gray-900">
                Exonération de TVA
              </p>
              <p class="text-sm text-gray-500">
                {{ form.taxExempt
                  ? 'Les produits sont créés avec une TVA à 0% par défaut (franchise en base de TVA).'
                  : 'Les produits sont créés avec une TVA à 20% par défaut.'
                }}
              </p>
            </div>
          </div>
        </section>

        <!-- Section: Adresse -->
        <section class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">
            Adresse
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Adresse *</label>
              <input
                v-model="form.street"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Complément d'adresse</label>
              <input
                v-model="form.street2"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Code postal *</label>
              <input
                v-model="form.postalCode"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Ville *</label>
              <input
                v-model="form.city"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Pays *</label>
              <select
                v-model="form.country"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">
                  Sélectionner...
                </option>
                <option
                  v-for="c in countries"
                  :key="c.id"
                  :value="c.id"
                >
                  {{ c.name }}
                </option>
              </select>
            </div>
          </div>
        </section>

        <!-- Section: Pages légales -->
        <section class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">
            Informations pour pages légales
          </h2>
          <p class="text-sm text-gray-500 mb-4">
            Ces informations sont affichées sur les pages légales du site (mentions légales, CGV, contact).
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Directeur de publication</label>
              <input
                v-model="form.publisherName"
                type="text"
                placeholder="Prénom Nom"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Hébergeur</label>
              <input
                v-model="form.hostingProvider"
                type="text"
                placeholder="Nom de l'hébergeur"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Adresse hébergeur</label>
              <input
                v-model="form.hostingAddress"
                type="text"
                placeholder="Adresse complète"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Téléphone hébergeur</label>
              <input
                v-model="form.hostingPhone"
                type="tel"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </section>

        <!-- Section: Numérotation documents -->
        <section class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">
            Numérotation des documents
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Préfixe reçus</label>
              <input
                v-model="form.documentPrefix"
                type="text"
                maxlength="10"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p class="text-xs text-gray-500 mt-1">
                Ex: REC-2025-00001
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Préfixe factures</label>
              <input
                v-model="form.invoicePrefix"
                type="text"
                maxlength="10"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p class="text-xs text-gray-500 mt-1">
                Ex: FA-2025-00001
              </p>
            </div>
          </div>
        </section>

        <!-- Submit button mobile -->
        <div class="md:hidden">
          <Button
            variant="primary"
            size="lg"
            class="w-full"
            :disabled="!hasChanges || saving"
            :loading="saving"
            type="submit"
          >
            Enregistrer
          </Button>
        </div>
      </form>
    </div>

    <!-- Tab: Roles -->
    <div v-else-if="activeTab === 'roles'">
      <div
        v-if="rolesLoading"
        class="text-gray-500"
      >
        Chargement...
      </div>

      <div
        v-else-if="roles.length === 0"
        class="text-gray-500"
      >
        Aucun rôle
      </div>

      <div
        v-else
        class="bg-white rounded-lg shadow overflow-hidden"
      >
        <table class="w-full">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Nom
              </th>
              <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Scope
              </th>
              <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th class="w-12" />
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr
              v-for="r in roles"
              :key="r.id"
              class="hover:bg-gray-100/50 cursor-pointer transition-colors"
              @click="editRole(r.id)"
            >
              <td class="px-6 py-4">
                <p class="font-medium text-gray-900">
                  {{ r.name }}
                </p>
                <p class="text-sm text-gray-500">
                  {{ r.description || '-' }}
                </p>
              </td>
              <td class="px-6 py-4">
                <span
                  :class="[
                    'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                    r.scope === 'admin'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  ]"
                >
                  {{ r.scope === 'admin' ? 'Admin' : 'Boutique' }}
                </span>
              </td>
              <td class="px-6 py-4">
                <span
                  :class="[
                    'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                    r.isSystem
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-purple-100 text-purple-700'
                  ]"
                >
                  {{ r.isSystem ? 'Système' : 'Personnalisé' }}
                </span>
              </td>
              <td class="px-6 py-4">
                <button
                  v-if="!r.isSystem"
                  class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Supprimer"
                  @click.stop="confirmDeleteRole(r)"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab: Users -->
    <div v-else-if="activeTab === 'users'">
      <DataTable
        v-model:filters-open="filtersOpen"
        :data="users"
        :columns="userColumns"
        :loading="usersLoading"
        :batch-actions="batchActions"
        :on-batch-action="handleBatchAction"
        :show-add="false"
        :searchable="false"
        filterable
        server-sort
        :active-filters-count="activeFiltersCount"
        empty-message="Aucun utilisateur"
        :on-row-click="openEditUser"
        @selection-change="handleSelectionChange"
        @apply-filters="applyFilters"
        @reset-filters="resetFilters"
        @sort="handleSort"
      >
        <template #filters>
          <FilterText
            v-model="searchFilter"
            label="Recherche"
            placeholder="Email, nom, prénom..."
          />
          <FilterSelect
            v-model="roleFilter"
            label="Rôle"
            :options="roleOptions"
          />
          <FilterSelect
            v-model="statusFilter"
            label="Statut"
            :options="statusOptions"
          />
        </template>
      </DataTable>

      <Pagination
        v-if="paginationMeta.totalPages > 1"
        :page="paginationMeta.page"
        :total-pages="paginationMeta.totalPages"
        :total="paginationMeta.total"
        :limit="paginationMeta.limit"
        @update:page="setPage"
      />
    </div>

    <!-- Tab: Clés d'API -->
    <div v-else-if="activeTab === 'api-keys'">
      <ApiKeysPanel />
    </div>

    <!-- Role Delete Modal -->
    <ConfirmModal
      :open="deleteRoleModalOpen"
      title="Supprimer le rôle"
      :message="`Voulez-vous vraiment supprimer le rôle « ${roleToDelete?.name} » ? Cette action est irréversible.`"
      confirm-label="Supprimer"
      @confirm="handleDeleteRole"
      @cancel="deleteRoleModalOpen = false"
    />

    <!-- User Delete Modal -->
    <ConfirmModal
      :open="showUserDeleteModal"
      title="Supprimer l'utilisateur"
      :message="`Voulez-vous vraiment supprimer ${userToDelete?.firstName} ${userToDelete?.lastName} ?`"
      confirm-label="Supprimer"
      @confirm="confirmDeleteUser"
      @cancel="showUserDeleteModal = false"
    />
  </div>
</template>
