<script setup lang="ts">
import { computed } from 'vue';
import type { CategoryNode, DragState } from '@/composables/categories';
import IconButton from '@/components/atoms/IconButton.vue';
import EditIcon from '@/components/atoms/icons/EditIcon.vue';
import CloseIcon from '@/components/atoms/icons/CloseIcon.vue';
import ChevronRightIcon from '@/components/atoms/icons/ChevronRightIcon.vue';
import ChevronDownIcon from '@/components/atoms/icons/ChevronDownIcon.vue';

const props = defineProps<{
  category: CategoryNode;
  dragState: DragState;
  expandedIds: Set<string>;
}>();

const emit = defineEmits<{
  edit: [category: CategoryNode];
  delete: [categoryId: string];
  toggleExpand: [categoryId: string];
  dragstart: [event: DragEvent, categoryId: string];
  dragend: [];
  dragover: [event: DragEvent, categoryId: string, position: 'before' | 'inside' | 'after'];
  dragleave: [event: DragEvent];
  drop: [event: DragEvent, categoryId: string, position: 'before' | 'inside' | 'after'];
}>();

const isExpanded = computed(() => props.expandedIds.has(props.category.id));
const hasChildren = computed(() => props.category.children.length > 0);
const isDragging = computed(() => props.dragState.draggedId === props.category.id);
const isDropTarget = computed(() => props.dragState.dropTargetId === props.category.id);
const dropPosition = computed(() => props.dragState.dropPosition);

// Détection de la zone de drop (haut 25%, milieu 50%, bas 25%)
function getDropPosition(e: DragEvent): 'before' | 'inside' | 'after' {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;

  if (y < height * 0.25) return 'before';
  if (y > height * 0.75) return 'after';
  return 'inside';
}

function onDragOver(e: DragEvent) {
  const position = getDropPosition(e);
  emit('dragover', e, props.category.id, position);
}

function onDrop(e: DragEvent) {
  const position = getDropPosition(e);
  emit('drop', e, props.category.id, position);
}

function onDragStart(e: DragEvent) {
  emit('dragstart', e, props.category.id);
}
</script>

<template>
  <div class="select-none">
    <!-- Drop indicator: before -->
    <div
      v-if="isDropTarget && dropPosition === 'before'"
      class="h-1 bg-blue-500 rounded-full"
      :style="{ marginLeft: `${20 + category.level * 24}px`, marginRight: '16px' }"
    />

    <!-- Category row -->
    <div
      class="group"
      draggable="true"
      data-category-drop
      @dragstart="onDragStart"
      @dragend="$emit('dragend')"
      @dragover="onDragOver"
      @dragleave="$emit('dragleave', $event)"
      @drop="onDrop"
    >
      <div
        :class="[
          'flex items-center gap-3 py-2.5 pr-5 cursor-grab transition-all rounded-xl mx-3',
          'hover:bg-gray-100',
          isDragging ? 'opacity-50 cursor-grabbing' : '',
          isDropTarget && dropPosition === 'inside'
            ? 'ring-2 ring-blue-500 ring-inset bg-blue-50'
            : '',
        ]"
        :style="{ paddingLeft: `${16 + category.level * 24}px` }"
      >
        <!-- Expand toggle -->
        <button
          v-if="hasChildren"
          class="p-1.5 hover:bg-gray-200 rounded-lg flex-shrink-0 cursor-pointer"
          @click.stop="$emit('toggleExpand', category.id)"
        >
          <ChevronDownIcon
            v-if="isExpanded"
            size="md"
            class="text-gray-500"
          />
          <ChevronRightIcon
            v-else
            size="md"
            class="text-gray-500"
          />
        </button>
        <span
          v-else
          class="w-6 flex-shrink-0"
        />

        <!-- Name -->
        <span class="flex-1 truncate text-lg font-medium text-gray-900">{{ category.name }}</span>

        <!-- Visibility badge -->
        <span
          v-if="!category.isVisible"
          class="text-sm text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg flex-shrink-0"
        >
          Masque
        </span>

        <!-- Actions (visible on hover) -->
        <div class="opacity-0 group-hover:opacity-100 flex gap-1.5 flex-shrink-0 cursor-pointer">
          <IconButton
            size="lg"
            title="Modifier"
            @click.stop="$emit('edit', category)"
          >
            <EditIcon size="md" />
          </IconButton>
          <IconButton
            size="lg"
            variant="danger"
            title="Supprimer"
            @click.stop="$emit('delete', category.id)"
          >
            <CloseIcon size="md" />
          </IconButton>
        </div>
      </div>
    </div>

    <!-- Drop indicator: after -->
    <div
      v-if="isDropTarget && dropPosition === 'after' && !hasChildren"
      class="h-1 bg-blue-500 rounded-full"
      :style="{ marginLeft: `${20 + category.level * 24}px`, marginRight: '16px' }"
    />

    <!-- Children (recursive) -->
    <template v-if="isExpanded && hasChildren">
      <CategoryTreeItem
        v-for="child in category.children"
        :key="child.id"
        :category="child"
        :drag-state="dragState"
        :expanded-ids="expandedIds"
        @edit="$emit('edit', $event)"
        @delete="$emit('delete', $event)"
        @toggle-expand="$emit('toggleExpand', $event)"
        @dragstart="(e, id) => $emit('dragstart', e, id)"
        @dragend="$emit('dragend')"
        @dragover="(e, id, pos) => $emit('dragover', e, id, pos)"
        @dragleave="$emit('dragleave', $event)"
        @drop="(e, id, pos) => $emit('drop', e, id, pos)"
      />
    </template>

    <!-- Drop indicator: after children (when expanded) -->
    <div
      v-if="isDropTarget && dropPosition === 'after' && hasChildren && isExpanded"
      class="h-1 bg-blue-500 rounded-full"
      :style="{ marginLeft: `${20 + category.level * 24}px`, marginRight: '16px' }"
    />
  </div>
</template>
