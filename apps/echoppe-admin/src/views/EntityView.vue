<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from '@/components/atoms/Button.vue';
import ConfirmModal from '@/components/atoms/ConfirmModal.vue';
import EntityGuard from '@/components/organisms/entities/EntityGuard.vue';
import EntityRowEditor from '@/components/organisms/entities/EntityRowEditor.vue';
import type { SerializedField } from '@/composables/content/types';
import type { EntityRow } from '@/composables/entities/types';
import { useEntityRows } from '@/composables/entities/useEntityRows';
import { useEntityScreen } from '@/composables/entities/useEntityScreen';
import type { EntityRowInput } from '@/composables/entities/useEntityRows';
import { useToast } from '@/composables/useToast';

// L'écran d'une entité. La cardinalité décide de ce qu'on voit — liste d'occurrences, ou formulaire
// direct pour un singleton (ADR-0039) : c'est le drapeau qui tranche, pas une préférence d'UI.
const route = useRoute();
const router = useRouter();
const toast = useToast();

const name = computed(() => String(route.params.name));
const { declaration, registry, ready, title, can } = useEntityScreen(name);
const { rows, loading, saving, denied, load, createRow, updateRow, deleteRow } = useEntityRows(name);

const rowToDelete = ref<EntityRow | null>(null);

onMounted(load);
watch(name, load);

// Les colonnes de la liste : les premiers champs qu'on peut rendre en une cellule. Les champs
// composés (`component`, `list`, `repeater`) ne s'y prêtent pas et restent au formulaire.
const FLAT_KINDS = new Set(['text', 'number', 'boolean', 'date', 'enum']);
const PREVIEW_COLUMNS = 3;

// « Les premiers » n'a de sens que parce que `fields` est une séquence (ADR-0049).
const previewFields = computed<SerializedField[]>(() => {
  const fields = declaration.value?.fields ?? [];
  return fields.filter((field) => FLAT_KINDS.has(field.kind)).slice(0, PREVIEW_COLUMNS);
});

function cell(row: EntityRow, name: string): string {
  const value = row[name];
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

// Le singleton : une occurrence au plus, créée à la première sauvegarde.
const singletonRow = computed(() => rows.value[0] ?? null);

async function saveSingleton(input: EntityRowInput) {
  const existing = singletonRow.value;
  const id = typeof existing?.id === 'string' ? existing.id : null;
  const saved = id ? await updateRow(id, input) : await createRow(input);
  toast[saved.ok ? 'success' : 'error'](saved.ok ? 'Enregistré' : (saved.message ?? 'Échec'));
}

async function confirmDelete() {
  const row = rowToDelete.value;
  rowToDelete.value = null;
  if (typeof row?.id !== 'string') return;
  const removed = await deleteRow(row.id);
  toast[removed.ok ? 'success' : 'error'](
    removed.ok ? 'Occurrence supprimée' : (removed.message ?? 'Échec de la suppression'),
  );
}
</script>

<template>
  <div class="p-6">
    <EntityGuard
      v-slot="{ declaration: entity, registry: definitions }"
      :ready="ready"
      :declaration="declaration"
      :registry="registry"
    >
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">
            {{ title }}
          </h1>
          <p class="text-sm text-gray-500">
            {{ entity.singleton ? 'Contenu unique.' : 'Occurrences de cette entité.' }}
          </p>
        </div>
        <Button
          v-if="!entity.singleton && can(entity, 'create')"
          variant="primary"
          @click="router.push({ name: 'entity-row-new', params: { name } })"
        >
          + Nouvelle occurrence
        </Button>
      </div>

      <p
        v-if="denied"
        class="rounded-lg border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500"
      >
        La lecture de cette entité vous a été refusée.
      </p>

      <p
        v-else-if="loading"
        class="py-10 text-center text-sm text-gray-400"
      >
        Chargement…
      </p>

      <!-- Singleton : pas de liste, le formulaire directement. -->
      <EntityRowEditor
        v-else-if="entity.singleton"
        :declaration="entity"
        :registry="definitions"
        :row="singletonRow"
        :saving="saving"
        :can-save="can(entity, singletonRow ? 'update' : 'create')"
        :can-delete="false"
        @save="saveSingleton"
      />

      <p
        v-else-if="rows.length === 0"
        class="rounded-lg border border-dashed border-gray-300 py-10 text-center text-sm text-gray-400"
      >
        Aucune occurrence pour l'instant.
      </p>

      <table
        v-else
        class="w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-sm"
      >
        <thead class="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
          <tr>
            <th class="px-4 py-3 font-medium">
              Slug
            </th>
            <th
              v-for="field in previewFields"
              :key="field.name"
              class="px-4 py-3 font-medium"
            >
              {{ field.label ?? field.name }}
            </th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="row in rows"
            :key="String(row.id)"
            class="cursor-pointer hover:bg-gray-50"
            @click="router.push({ name: 'entity-row-edit', params: { name, id: String(row.id) } })"
          >
            <td class="px-4 py-3 font-medium text-gray-800">
              {{ cell(row, 'slug') }}
            </td>
            <td
              v-for="field in previewFields"
              :key="field.name"
              class="px-4 py-3 text-gray-500"
            >
              {{ cell(row, field.name) }}
            </td>
            <td class="px-4 py-3 text-right">
              <button
                v-if="can(entity, 'delete')"
                type="button"
                class="text-gray-400 hover:text-red-500"
                @click.stop="rowToDelete = row"
              >
                Supprimer
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </EntityGuard>

    <ConfirmModal
      :open="rowToDelete !== null"
      title="Supprimer l'occurrence"
      :message="`Supprimer « ${cell(rowToDelete ?? {}, 'slug')} » ? Cette action est irréversible.`"
      confirm-label="Supprimer"
      @confirm="confirmDelete"
      @cancel="rowToDelete = null"
    />
  </div>
</template>
