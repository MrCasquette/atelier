<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Category, CategoryNode, CategoryFormData } from '@/composables/categories';
import Modal from '@/components/atoms/Modal.vue';
import Button from '@/components/atoms/Button.vue';
import MediaPicker from '@/components/molecules/MediaPicker.vue';

const props = defineProps<{
  category: Category | null; // null = création
  parentOptions: CategoryNode[];
  saving: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [data: CategoryFormData];
}>();

const form = ref<CategoryFormData>({
  name: '',
  description: '',
  parent: null,
  image: null,
  sortOrder: 0,
  isVisible: true,
});

// Initialiser le formulaire quand la catégorie change
watch(
  () => props.category,
  (cat) => {
    if (cat) {
      form.value = {
        name: cat.name,
        description: cat.description || '',
        parent: cat.parent,
        image: cat.image,
        sortOrder: cat.sortOrder,
        isVisible: cat.isVisible,
      };
    } else {
      form.value = {
        name: '',
        description: '',
        parent: null,
        image: null,
        sortOrder: 0,
        isVisible: true,
      };
    }
  },
  { immediate: true }
);

function handleSubmit() {
  emit('save', { ...form.value });
}
</script>

<template>
  <Modal
    :title="category ? 'Modifier la categorie' : 'Nouvelle categorie'"
    size="md"
    @close="$emit('close')"
  >
    <form
      class="space-y-4"
      @submit.prevent="handleSubmit"
    >
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Nom</label>
        <input
          v-model="form.name"
          type="text"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Ex: Vetements"
        />
      </div>

      <div v-if="category">
        <label class="block text-sm font-medium text-gray-700 mb-1">Slug</label>
        <input
          :value="category.slug"
          type="text"
          disabled
          class="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          v-model="form.description"
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Description optionnelle..."
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Categorie parente</label>
        <select
          v-model="form.parent"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option :value="null">
            Aucune (racine)
          </option>
          <option
            v-for="opt in parentOptions"
            :key="opt.id"
            :value="opt.id"
          >
            {{ '\u2014'.repeat(opt.level) }} {{ opt.name }}
          </option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Image</label>
        <MediaPicker v-model="form.image" />
      </div>
    </form>

    <template #footer>
      <div class="flex justify-end gap-3">
        <Button @click="$emit('close')">
          Annuler
        </Button>
        <Button
          variant="primary"
          :loading="saving"
          @click="handleSubmit"
        >
          {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
