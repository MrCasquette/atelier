<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import Modal from '@/components/atoms/Modal.vue';
import Button from '@/components/atoms/Button.vue';

interface FolderOption {
  id: string;
  name: string;
  level: number;
}

const props = defineProps<{
  open: boolean;
  mode: 'create' | 'edit';
  folderName?: string;
  parentId?: string | null;
  folderOptions: FolderOption[];
  excludeFolderId?: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [data: { name: string; parentId: string | null }];
}>();

const name = ref('');
const selectedParentId = ref<string | null>(null);

watch(
  () => props.open,
  (open) => {
    if (open) {
      name.value = props.folderName || '';
      selectedParentId.value = props.parentId ?? null;
    }
  },
  { immediate: true }
);

const title = computed(() => props.mode === 'create' ? 'Nouveau dossier' : 'Modifier le dossier');
const submitLabel = computed(() => props.mode === 'create' ? 'Creer' : 'Enregistrer');

const filteredOptions = computed(() => {
  if (!props.excludeFolderId) return props.folderOptions;
  return props.folderOptions.filter((f) => f.id !== props.excludeFolderId);
});

function handleSubmit() {
  if (!name.value.trim()) return;
  emit('submit', { name: name.value.trim(), parentId: selectedParentId.value });
}
</script>

<template>
  <Modal
    v-if="open"
    :title="title"
    @close="emit('close')"
  >
    <div class="space-y-3">
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Nom</label>
        <input
          v-model="name"
          type="text"
          placeholder="Nom du dossier"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg"
          autofocus
          @keyup.enter="handleSubmit"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Dossier parent</label>
        <select
          v-model="selectedParentId"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option :value="null">
            Racine
          </option>
          <option
            v-for="f in filteredOptions"
            :key="f.id"
            :value="f.id"
          >
            {{ '\u2014'.repeat(f.level) }} {{ f.name }}
          </option>
        </select>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button @click="emit('close')">
          Annuler
        </Button>
        <Button
          variant="primary"
          @click="handleSubmit"
        >
          {{ submitLabel }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
