<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCategories, type CategoryNode, type CategoryFormData } from '@/composables/categories';
import Button from '@/components/atoms/Button.vue';
import ConfirmModal from '@/components/atoms/ConfirmModal.vue';
import CategoryTree from '@/components/organisms/CategoryTree.vue';
import CategoryFormModal from '@/components/organisms/CategoryFormModal.vue';

const {
  loading,
  dragState,
  categoryTree,
  flatCategoryList,
  getValidParentOptions,
  loadCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleRootDrop,
} = useCategories();

// Modals state
const showForm = ref(false);
const editingCategory = ref<CategoryNode | null>(null);
const saving = ref(false);
const deleteModalOpen = ref(false);
const categoryToDelete = ref<string | null>(null);
const categoryToDeleteName = ref('');

onMounted(loadCategories);

// Form actions
function openCreate() {
  editingCategory.value = null;
  showForm.value = true;
}

function openEdit(category: CategoryNode) {
  editingCategory.value = category;
  showForm.value = true;
}

async function handleSave(data: CategoryFormData) {
  saving.value = true;
  if (editingCategory.value) {
    await updateCategory(editingCategory.value.id, data);
  } else {
    await createCategory(data);
  }
  saving.value = false;
  showForm.value = false;
}

function closeForm() {
  showForm.value = false;
  editingCategory.value = null;
}

// Delete actions
function confirmDelete(categoryId: string) {
  const cat = flatCategoryList.value.find(c => c.id === categoryId);
  categoryToDelete.value = categoryId;
  categoryToDeleteName.value = cat?.name || '';
  deleteModalOpen.value = true;
}

async function handleDelete() {
  if (!categoryToDelete.value) return;
  await deleteCategory(categoryToDelete.value);
  deleteModalOpen.value = false;
  categoryToDelete.value = null;
  categoryToDeleteName.value = '';
}

function cancelDelete() {
  deleteModalOpen.value = false;
  categoryToDelete.value = null;
  categoryToDeleteName.value = '';
}
</script>

<template>
  <div>
    <div class="flex justify-end mb-4">
      <Button
        variant="primary"
        size="lg"
        @click="openCreate"
      >
        Nouvelle catégorie
      </Button>
    </div>

    <CategoryTree
      :categories="categoryTree"
      :drag-state="dragState"
      :loading="loading"
      @edit="openEdit"
      @delete="confirmDelete"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @root-drop="handleRootDrop"
    />

    <CategoryFormModal
      v-if="showForm"
      :category="editingCategory"
      :parent-options="editingCategory
        ? getValidParentOptions(editingCategory.id)
        : flatCategoryList"
      :saving="saving"
      @close="closeForm"
      @save="handleSave"
    />

    <ConfirmModal
      :open="deleteModalOpen"
      title="Supprimer la categorie"
      :message="`Voulez-vous vraiment supprimer la categorie « ${categoryToDeleteName} » ? Les sous-categories seront egalement supprimees.`"
      confirm-label="Supprimer"
      @confirm="handleDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>
