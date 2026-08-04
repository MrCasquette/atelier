<script setup lang="ts">
import type { FolderNode } from '@/composables/media';
import IconButton from '@/components/atoms/IconButton.vue';
import FolderIcon from '@/components/atoms/icons/FolderIcon.vue';
import EditIcon from '@/components/atoms/icons/EditIcon.vue';
import CloseIcon from '@/components/atoms/icons/CloseIcon.vue';

defineProps<{
  folder: FolderNode;
  isActive: boolean;
  isDropTarget: boolean;
  isDragging: boolean;
  showActions?: boolean;
}>();

defineEmits<{
  click: [];
  edit: [event: Event];
  delete: [event: Event];
  dragstart: [event: DragEvent];
  dragend: [];
  dragover: [event: DragEvent];
  dragleave: [event: DragEvent];
  drop: [event: DragEvent];
}>();
</script>

<template>
  <div class="group">
    <button
      draggable="true"
      data-folder-drop
      :class="[
        'w-full flex items-center gap-2 py-1.5 pr-2 text-left text-sm transition',
        isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700',
        isDropTarget ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : '',
        isDragging ? 'opacity-50' : ''
      ]"
      :style="{ paddingLeft: `${12 + folder.level * 12}px` }"
      @click="$emit('click')"
      @dragstart="$emit('dragstart', $event)"
      @dragend="$emit('dragend')"
      @dragover="$emit('dragover', $event)"
      @dragleave="$emit('dragleave', $event)"
      @drop="$emit('drop', $event)"
    >
      <FolderIcon
        size="sm"
        class="text-yellow-500 flex-shrink-0"
      />
      <span class="truncate flex-1">{{ folder.name }}</span>
      <div
        v-if="showActions"
        class="opacity-0 group-hover:opacity-100 flex gap-0.5"
      >
        <IconButton
          size="sm"
          title="Modifier"
          @click="$emit('edit', $event)"
        >
          <EditIcon size="xs" />
        </IconButton>
        <IconButton
          size="sm"
          variant="danger"
          title="Supprimer"
          @click="$emit('delete', $event)"
        >
          <CloseIcon size="xs" />
        </IconButton>
      </div>
    </button>
  </div>
</template>
