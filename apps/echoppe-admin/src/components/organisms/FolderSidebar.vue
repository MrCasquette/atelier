<script setup lang="ts">
import type { FolderNode } from '@/composables/media';
import IconButton from '@/components/atoms/IconButton.vue';
import PlusIcon from '@/components/atoms/icons/PlusIcon.vue';
import HomeIcon from '@/components/atoms/icons/HomeIcon.vue';
import FolderTreeItem from '@/components/molecules/FolderTreeItem.vue';

defineProps<{
  folders: FolderNode[];
  currentFolder: string | null;
  dropTargetFolderId: string | null;
  draggedFolderId: string | null;
  isDraggingToRoot: boolean;
}>();

defineEmits<{
  navigate: [folderId: string | null];
  newFolder: [];
  editFolder: [folder: FolderNode, event: Event];
  deleteFolder: [folderId: string, event: Event];
  folderDragStart: [event: DragEvent, folderId: string];
  folderDragEnd: [];
  folderDragOver: [event: DragEvent, folderId: string];
  folderDragLeave: [event: DragEvent];
  folderDrop: [event: DragEvent, folderId: string | null];
  rootDragOver: [event: DragEvent];
  rootDragLeave: [];
}>();
</script>

<template>
  <aside class="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
    <div class="p-3 border-b border-gray-200 flex items-center justify-between">
      <h2 class="font-medium text-sm text-gray-900">
        Dossiers
      </h2>
      <IconButton
        variant="default"
        title="Nouveau dossier"
        @click="$emit('newFolder')"
      >
        <PlusIcon size="sm" />
      </IconButton>
    </div>

    <nav class="flex-1 overflow-auto py-2">
      <!-- Root -->
      <button
        data-folder-drop
        :class="[
          'w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition',
          currentFolder === null ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700',
          isDraggingToRoot ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''
        ]"
        @click="$emit('navigate', null)"
        @dragover="$emit('rootDragOver', $event)"
        @dragleave="$emit('rootDragLeave')"
        @drop="$emit('folderDrop', $event, null)"
      >
        <HomeIcon
          size="sm"
          class="flex-shrink-0"
        />
        <span class="truncate">Tous les fichiers</span>
      </button>

      <!-- Folder tree -->
      <div class="mt-1">
        <FolderTreeItem
          v-for="folder in folders"
          :key="folder.id"
          :folder="folder"
          :is-active="currentFolder === folder.id"
          :is-drop-target="dropTargetFolderId === folder.id"
          :is-dragging="draggedFolderId === folder.id"
          show-actions
          @click="$emit('navigate', folder.id)"
          @edit="$emit('editFolder', folder, $event)"
          @delete="$emit('deleteFolder', folder.id, $event)"
          @dragstart="$emit('folderDragStart', $event, folder.id)"
          @dragend="$emit('folderDragEnd')"
          @dragover="$emit('folderDragOver', $event, folder.id)"
          @dragleave="$emit('folderDragLeave', $event)"
          @drop="$emit('folderDrop', $event, folder.id)"
        />
      </div>
    </nav>
  </aside>
</template>
