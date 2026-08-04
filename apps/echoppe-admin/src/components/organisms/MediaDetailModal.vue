<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Media } from '@/composables/media';
import { getMediaUrl } from '@/composables/media';
import Button from '@/components/atoms/Button.vue';
import ConfirmModal from '@/components/atoms/ConfirmModal.vue';
import CloseIcon from '@/components/atoms/icons/CloseIcon.vue';
import FormField from '@/components/molecules/FormField.vue';
import MediaPreview from '@/components/molecules/MediaPreview.vue';
import MediaInfo from '@/components/molecules/MediaInfo.vue';

const props = defineProps<{
  media: Media;
}>();

const emit = defineEmits<{
  close: [];
  save: [data: { title: string; description: string; alt: string }];
  delete: [id: string];
}>();

const editForm = ref({
  title: '',
  description: '',
  alt: '',
});

const isSaving = ref(false);
const showDeleteConfirm = ref(false);

watch(
  () => props.media,
  (media) => {
    editForm.value = {
      title: media.title || '',
      description: media.description || '',
      alt: media.alt || '',
    };
  },
  { immediate: true }
);

async function handleSave() {
  isSaving.value = true;
  emit('save', { ...editForm.value });
  isSaving.value = false;
}

function handleDelete() {
  showDeleteConfirm.value = true;
}

function confirmDelete() {
  emit('delete', props.media.id);
  showDeleteConfirm.value = false;
}
</script>

<template>
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-auto">
      <div class="flex">
        <!-- Preview -->
        <div class="w-1/2">
          <MediaPreview :media="media" />
        </div>

        <!-- Details -->
        <div class="w-1/2 p-5 flex flex-col">
          <div class="flex items-start justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">
              Details
            </h2>
            <button
              class="text-gray-400 hover:text-gray-600 p-1"
              @click="$emit('close')"
            >
              <CloseIcon />
            </button>
          </div>

          <!-- Edit form -->
          <div class="space-y-3 flex-1">
            <FormField
              v-model="editForm.title"
              label="Titre"
              placeholder="Titre pour la recherche"
            />
            <FormField
              v-model="editForm.alt"
              label="Texte alternatif"
              placeholder="Description pour l'accessibilite"
            />
            <FormField
              v-model="editForm.description"
              label="Description"
              type="textarea"
              :rows="2"
            />
            <Button
              variant="primary"
              class="w-full"
              :loading="isSaving"
              @click="handleSave"
            >
              {{ isSaving ? 'Enregistrement...' : 'Enregistrer' }}
            </Button>
          </div>

          <!-- Info -->
          <div class="mt-4 pt-4 border-t border-gray-200">
            <MediaInfo :media="media" />
          </div>

          <!-- Actions -->
          <div class="mt-4 pt-4 border-t border-gray-200 flex gap-2">
            <a
              :href="getMediaUrl(media)"
              download
              class="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm text-center hover:bg-gray-50"
            >
              Telecharger
            </a>
            <Button
              variant="danger"
              class="flex-1"
              @click="handleDelete"
            >
              Supprimer
            </Button>
          </div>
        </div>
      </div>
    </div>

    <ConfirmModal
      :open="showDeleteConfirm"
      title="Supprimer le fichier"
      message="Supprimer ce fichier ? Cette action est irréversible."
      confirm-label="Supprimer"
      @confirm="confirmDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>
