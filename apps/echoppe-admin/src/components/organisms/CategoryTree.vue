<script setup lang="ts">
import { ref, watch } from 'vue';
import type { CategoryNode, DragState } from '@/composables/categories';
import CategoryTreeItem from '@/components/molecules/CategoryTreeItem.vue';

const props = defineProps<{
  categories: CategoryNode[];
  dragState: DragState;
  loading: boolean;
}>();

const emit = defineEmits<{
  edit: [category: CategoryNode];
  delete: [categoryId: string];
  dragstart: [event: DragEvent, categoryId: string];
  dragend: [];
  dragover: [event: DragEvent, categoryId: string, position: 'before' | 'inside' | 'after'];
  dragleave: [event: DragEvent];
  drop: [event: DragEvent, categoryId: string, position: 'before' | 'inside' | 'after'];
  rootDrop: [event: DragEvent];
}>();

// Gestion de l'expansion locale
const expandedIds = ref<Set<string>>(new Set());

function toggleExpand(id: string) {
  const newSet = new Set(expandedIds.value);
  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }
  expandedIds.value = newSet;
}

// Auto-expand toutes les catégories avec enfants au chargement
watch(
  () => props.categories,
  (cats) => {
    const newExpanded = new Set<string>();
    function collectParents(nodes: CategoryNode[]) {
      for (const node of nodes) {
        if (node.children.length > 0) {
          newExpanded.add(node.id);
          collectParents(node.children);
        }
      }
    }
    collectParents(cats);
    expandedIds.value = newExpanded;
  },
  { immediate: true }
);

// Zone de drop racine
const isRootDropTarget = ref(false);

function handleRootDragOver(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (props.dragState.draggedId) {
    isRootDropTarget.value = true;
  }
}

function handleRootDragLeave() {
  isRootDropTarget.value = false;
}

function handleRootDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  isRootDropTarget.value = false;
  emit('rootDrop', e);
}
</script>

<template>
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-700">
          Arborescence des categories
        </h3>
        <span class="text-xs text-gray-500">Glissez pour reorganiser</span>
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="p-8 text-center text-gray-500"
    >
      Chargement...
    </div>

    <!-- Empty state -->
    <div
      v-else-if="categories.length === 0"
      class="p-12 text-center text-gray-400"
    >
      <p class="text-lg">
        Aucune categorie
      </p>
      <p class="text-sm mt-2">
        Cliquez sur "Nouvelle categorie" pour commencer
      </p>
    </div>

    <!-- Tree -->
    <div
      v-else
      class="py-4"
    >
      <!-- Root drop zone -->
      <div
        :class="[
          'mx-4 mb-3 px-5 py-4 rounded-xl text-base text-gray-500 transition border-2 border-dashed',
          isRootDropTarget
            ? 'border-blue-400 bg-blue-50 text-blue-600'
            : 'border-transparent hover:border-gray-200'
        ]"
        @dragover="handleRootDragOver"
        @dragleave="handleRootDragLeave"
        @drop="handleRootDrop"
      >
        Deposer ici pour mettre a la racine
      </div>

      <!-- Categories -->
      <CategoryTreeItem
        v-for="cat in categories"
        :key="cat.id"
        :category="cat"
        :drag-state="dragState"
        :expanded-ids="expandedIds"
        @edit="$emit('edit', $event)"
        @delete="$emit('delete', $event)"
        @toggle-expand="toggleExpand"
        @dragstart="(e, id) => $emit('dragstart', e, id)"
        @dragend="$emit('dragend')"
        @dragover="(e, id, pos) => $emit('dragover', e, id, pos)"
        @dragleave="$emit('dragleave', $event)"
        @drop="(e, id, pos) => $emit('drop', e, id, pos)"
      />
    </div>
  </div>
</template>
