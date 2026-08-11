<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ConfirmModal from '@/components/atoms/ConfirmModal.vue';
import EntityGuard from '@/components/organisms/entities/EntityGuard.vue';
import EntityRowEditor from '@/components/organisms/entities/EntityRowEditor.vue';
import { useEntityRows } from '@/composables/entities/useEntityRows';
import type { EntityRowInput } from '@/composables/entities/useEntityRows';
import { useEntityScreen } from '@/composables/entities/useEntityScreen';
import { useToast } from '@/composables/useToast';

// Une occurrence d'entité de liste : création (`/entites/:name/nouveau`) ou édition
// (`/entites/:name/:id`). Un singleton ne passe jamais ici — il s'édite sur son écran (ADR-0039).
const route = useRoute();
const router = useRouter();
const toast = useToast();

const name = computed(() => String(route.params.name));
const rowId = computed(() => (typeof route.params.id === 'string' ? route.params.id : null));

const { declaration, registry, ready, title, can } = useEntityScreen(name);
const { rows, loading, saving, load, createRow, updateRow, deleteRow } = useEntityRows(name);

const deleteOpen = ref(false);

onMounted(load);
watch(name, load);

const row = computed(() => rows.value.find((candidate) => candidate.id === rowId.value) ?? null);
const missing = computed(() => rowId.value !== null && !loading.value && row.value === null);

function backToList() {
  router.push({ name: 'entity', params: { name: name.value } });
}

async function save(input: EntityRowInput) {
  const id = rowId.value;
  const saved = id ? await updateRow(id, input) : await createRow(input);
  if (!saved.ok) {
    toast.error(saved.message ?? "Échec de l'enregistrement");
    return;
  }
  toast.success('Enregistré');
  // Après une création, l'écran n'a plus d'objet : l'occurrence existe, la liste la porte.
  if (!id) backToList();
}

async function confirmDelete() {
  deleteOpen.value = false;
  const id = rowId.value;
  if (!id) return;
  const removed = await deleteRow(id);
  if (!removed.ok) {
    toast.error(removed.message ?? 'Échec de la suppression');
    return;
  }
  toast.success('Occurrence supprimée');
  backToList();
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
      <div class="mb-6">
        <button
          type="button"
          class="mb-2 text-sm text-gray-500 hover:text-gray-700"
          @click="backToList"
        >
          ← {{ title }}
        </button>
        <h1 class="text-xl font-semibold text-gray-900">
          {{ rowId ? 'Modifier l\'occurrence' : 'Nouvelle occurrence' }}
        </h1>
      </div>

      <p
        v-if="loading"
        class="py-10 text-center text-sm text-gray-400"
      >
        Chargement…
      </p>

      <p
        v-else-if="missing"
        class="rounded-lg border border-dashed border-gray-300 py-10 text-center text-sm text-gray-400"
      >
        Cette occurrence n'existe pas ou plus.
      </p>

      <EntityRowEditor
        v-else
        :declaration="entity"
        :registry="definitions"
        :row="row"
        :saving="saving"
        :can-save="can(entity, rowId ? 'update' : 'create')"
        :can-delete="can(entity, 'delete')"
        @save="save"
        @delete="deleteOpen = true"
      />
    </EntityGuard>

    <ConfirmModal
      :open="deleteOpen"
      title="Supprimer l'occurrence"
      message="Supprimer cette occurrence ? Cette action est irréversible."
      confirm-label="Supprimer"
      @confirm="confirmDelete"
      @cancel="deleteOpen = false"
    />
  </div>
</template>
