<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Badge from '@/components/atoms/Badge.vue';
import Button from '@/components/atoms/Button.vue';
import Checkbox from '@/components/atoms/Checkbox.vue';
import ConfirmModal from '@/components/atoms/ConfirmModal.vue';
import Input from '@/components/atoms/Input.vue';
import Label from '@/components/atoms/Label.vue';
import Modal from '@/components/atoms/Modal.vue';
import { type ApiKey, type CreatedApiKey, type Scope, useApiKeys } from '@/composables/useApiKeys';
import { useToast } from '@/composables/useToast';

const toast = useToast();
const { keys, scopes, loading, saving, loadKeys, loadScopes, createKey, revokeKey } = useApiKeys();

onMounted(() => {
  loadKeys();
  loadScopes();
});

// ── Scopes regroupés par ressource (pour la grille de création) ────────────────────────────────
interface ScopeGroup {
  resource: string;
  read?: Scope;
  write?: Scope;
}

const scopeGroups = computed<ScopeGroup[]>(() => {
  const map = new Map<string, ScopeGroup>();
  for (const scope of scopes.value) {
    const [action, resource] = scope.split(':');
    const group = map.get(resource) ?? { resource };
    if (action === 'read') group.read = scope;
    else if (action === 'write') group.write = scope;
    map.set(resource, group);
  }
  return [...map.values()];
});

// ── Création ────────────────────────────────────────────────────────────────────────────────────
const createOpen = ref(false);
const name = ref('');
const selected = ref<Scope[]>([]);
const expiresAt = ref('');

const canSubmit = computed(() => name.value.trim().length > 0 && selected.value.length > 0);

function resetForm() {
  name.value = '';
  selected.value = [];
  expiresAt.value = '';
}

function openCreate() {
  resetForm();
  createOpen.value = true;
}

const isSelected = (scope: Scope) => selected.value.includes(scope);

function toggleScope(scope: Scope) {
  selected.value = isSelected(scope)
    ? selected.value.filter((s) => s !== scope)
    : [...selected.value, scope];
}

// Cases de la ressource entière : coche/décoche read + write d'un coup (le premier coche les deux).
const groupScopes = (group: ScopeGroup): Scope[] =>
  [group.read, group.write].filter((s): s is Scope => s !== undefined);
const isGroupAll = (group: ScopeGroup) => groupScopes(group).every(isSelected);

function toggleGroup(group: ScopeGroup) {
  const all = groupScopes(group);
  selected.value = isGroupAll(group)
    ? selected.value.filter((s) => !all.includes(s))
    : [...new Set([...selected.value, ...all])];
}

// Révélation du secret : renvoyé une seule fois par l'API à la création.
const revealed = ref<CreatedApiKey | null>(null);

async function submit() {
  if (!canSubmit.value) return;
  const created = await createKey({
    name: name.value.trim(),
    scopes: selected.value,
    expiresAt: expiresAt.value ? new Date(expiresAt.value).toISOString() : null,
  });
  if (created) {
    createOpen.value = false;
    revealed.value = created;
    toast.success('Clé créée');
  } else {
    toast.error('Erreur lors de la création de la clé');
  }
}

async function copyKey() {
  if (!revealed.value) return;
  try {
    await navigator.clipboard.writeText(revealed.value.key);
    toast.success('Clé copiée dans le presse-papiers');
  } catch {
    toast.error('Impossible de copier — sélectionnez et copiez manuellement');
  }
}

// ── Révocation ────────────────────────────────────────────────────────────────────────────────
const keyToRevoke = ref<ApiKey | null>(null);

async function handleRevoke() {
  if (!keyToRevoke.value) return;
  const ok = await revokeKey(keyToRevoke.value.id);
  toast[ok ? 'success' : 'error'](ok ? 'Clé révoquée' : 'Erreur lors de la révocation');
  keyToRevoke.value = null;
}

// ── Affichage ─────────────────────────────────────────────────────────────────────────────────
function formatDateTime(date: Date | string | null) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

const isExpired = (date: Date | string | null) => date !== null && new Date(date) < new Date();
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-start justify-between mb-4">
      <p class="text-sm text-gray-500 max-w-2xl">
        Jetons d'authentification machine (CLI, CI, intégrations) au format
        <code class="text-gray-700">eck_…</code>. Le secret n'est affiché qu'à la création.
        Une clé n'accorde que ses portées, jamais plus.
      </p>
      <Button
        variant="primary"
        @click="openCreate"
      >
        Nouvelle clé
      </Button>
    </div>

    <div
      v-if="loading"
      class="text-gray-500"
    >
      Chargement...
    </div>

    <div
      v-else-if="keys.length === 0"
      class="text-gray-500 bg-white rounded-lg shadow p-6"
    >
      Aucune clé d'API. Créez-en une pour connecter une intégration.
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
              Portées
            </th>
            <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
              Dernière utilisation
            </th>
            <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
              Expiration
            </th>
            <th class="w-12" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr
            v-for="key in keys"
            :key="key.id"
            class="hover:bg-gray-100/50 transition-colors"
          >
            <td class="px-6 py-4">
              <p class="font-medium text-gray-900">
                {{ key.name }}
              </p>
              <p class="text-xs text-gray-500">
                Créée le {{ formatDateTime(key.dateCreated) }}
              </p>
            </td>
            <td class="px-6 py-4">
              <div class="flex flex-wrap gap-1">
                <Badge
                  v-for="scope in key.scopes"
                  :key="scope"
                  :variant="scope.startsWith('write:') ? 'warning' : 'info'"
                  size="sm"
                >
                  {{ scope }}
                </Badge>
              </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
              {{ key.lastUsedAt ? formatDateTime(key.lastUsedAt) : 'Jamais' }}
            </td>
            <td class="px-6 py-4 text-sm">
              <Badge
                v-if="isExpired(key.expiresAt)"
                variant="error"
                size="sm"
              >
                Expirée
              </Badge>
              <span
                v-else
                class="text-gray-500"
              >
                {{ key.expiresAt ? formatDateTime(key.expiresAt) : 'Jamais' }}
              </span>
            </td>
            <td class="px-6 py-4">
              <button
                class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Révoquer"
                @click="keyToRevoke = key"
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

    <!-- Modal : création -->
    <Modal
      v-if="createOpen"
      title="Nouvelle clé d'API"
      size="lg"
      @close="createOpen = false"
    >
      <div class="p-6 space-y-5">
        <div>
          <Label required>Nom</Label>
          <Input
            v-model="name"
            placeholder="ex. front-dpc, ci-github…"
          />
        </div>

        <div>
          <Label required>Portées</Label>
          <p class="text-xs text-gray-500 mb-2">
            Cocher la ressource sélectionne lecture + écriture. « Écriture » couvre création,
            modification et suppression.
          </p>
          <div class="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
            <div
              v-for="group in scopeGroups"
              :key="group.resource"
              class="flex items-center justify-between px-4 py-2.5"
            >
              <button
                type="button"
                class="flex items-center gap-2 text-sm font-medium text-gray-800"
                @click="toggleGroup(group)"
              >
                <Checkbox
                  :checked="isGroupAll(group)"
                  size="sm"
                />
                {{ group.resource }}
              </button>
              <div class="flex items-center gap-4">
                <button
                  v-if="group.read"
                  type="button"
                  class="flex items-center gap-1.5 text-sm text-gray-600"
                  @click="toggleScope(group.read)"
                >
                  <Checkbox
                    :checked="isSelected(group.read)"
                    size="sm"
                  />
                  Lecture
                </button>
                <button
                  v-if="group.write"
                  type="button"
                  class="flex items-center gap-1.5 text-sm text-gray-600"
                  @click="toggleScope(group.write)"
                >
                  <Checkbox
                    :checked="isSelected(group.write)"
                    size="sm"
                  />
                  Écriture
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <Label>Expiration (optionnelle)</Label>
          <input
            v-model="expiresAt"
            type="date"
            class="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <p class="text-xs text-gray-500 mt-1">
            Sans date, la clé n'expire jamais.
          </p>
        </div>
      </div>

      <div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
        <Button
          variant="secondary"
          @click="createOpen = false"
        >
          Annuler
        </Button>
        <Button
          variant="primary"
          :disabled="!canSubmit || saving"
          :loading="saving"
          @click="submit"
        >
          Créer la clé
        </Button>
      </div>
    </Modal>

    <!-- Modal : révélation du secret (une seule fois) -->
    <Modal
      v-if="revealed"
      title="Clé créée"
      size="lg"
      @close="revealed = null"
    >
      <div class="p-6 space-y-4">
        <div class="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <span class="text-amber-600">⚠️</span>
          <p class="text-sm text-amber-800">
            Copiez cette clé <strong>maintenant</strong> : elle ne sera plus jamais affichée. En
            cas de perte, révoquez-la et créez-en une nouvelle.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-100 rounded text-sm text-gray-800 break-all">
            {{ revealed.key }}
          </code>
          <Button
            variant="secondary"
            @click="copyKey"
          >
            Copier
          </Button>
        </div>
      </div>
      <div class="flex justify-end px-6 py-4 border-t border-gray-100">
        <Button
          variant="primary"
          @click="revealed = null"
        >
          J'ai copié la clé
        </Button>
      </div>
    </Modal>

    <!-- Révocation -->
    <ConfirmModal
      :open="keyToRevoke !== null"
      title="Révoquer la clé"
      :message="`Révoquer « ${keyToRevoke?.name} » ? Toute intégration l'utilisant cessera immédiatement de fonctionner. Cette action est irréversible.`"
      confirm-label="Révoquer"
      @confirm="handleRevoke"
      @cancel="keyToRevoke = null"
    />
  </div>
</template>
