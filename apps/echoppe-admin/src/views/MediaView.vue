<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import {
  type Media,
  type FolderNode,
  type ViewMode,
  type GridSize,
  type SortBy,
  type SortOrder,
  type MediaType,
  type ContextMenuState,
  useMedia,
  getMediaUrl,
} from '@/composables/media';
import Button from '@/components/atoms/Button.vue';
import Modal from '@/components/atoms/Modal.vue';
import ConfirmModal from '@/components/atoms/ConfirmModal.vue';
import ChevronDownIcon from '@/components/atoms/icons/ChevronDownIcon.vue';
import ChevronUpIcon from '@/components/atoms/icons/ChevronUpIcon.vue';
import ImageIcon from '@/components/atoms/icons/ImageIcon.vue';
import Breadcrumb from '@/components/molecules/Breadcrumb.vue';
import SearchInput from '@/components/molecules/SearchInput.vue';
import ContextMenu from '@/components/molecules/ContextMenu.vue';
import type { ContextMenuItem } from '@/components/molecules/ContextMenu.vue';
import ViewToggle from '@/components/molecules/ViewToggle.vue';
import GridSizeToggle from '@/components/molecules/GridSizeToggle.vue';
import FolderSidebar from '@/components/organisms/FolderSidebar.vue';
import MediaGrid from '@/components/organisms/MediaGrid.vue';
import MediaList from '@/components/organisms/MediaList.vue';
import MediaDetailModal from '@/components/organisms/MediaDetailModal.vue';

// === UI STATE ===
const viewMode = ref<ViewMode>('grid');
const gridSize = ref<GridSize>('medium');
const searchQuery = ref('');
const sortBy = ref<SortBy>('date');
const sortOrder = ref<SortOrder>('desc');
const mediaType = ref<MediaType>('all');
const searchInputRef = ref<InstanceType<typeof SearchInput> | null>(null);
const uploading = ref(false);
const dragOver = ref(false);

// === COMPOSABLE ===
const {
  currentFolder,
  mediaItems,
  loading,
  selectedItems,
  draggedMediaIds,
  draggedFolderId,
  dropTargetFolderId,
  isDraggingToRoot,
  flatFolderList,
  breadcrumb,
  loadFolders,
  createFolder,
  updateFolder,
  deleteFolder: deleteFolderApi,
  navigateToFolder,
  getValidParentOptions,
  loadMedia,
  updateMedia,
  deleteMedia,
  deleteMediaBatch,
  moveMediaBatch,
  uploadFiles,
  handleItemClick,
  handleCheckboxClick,
  clearSelection,
  selectAll,
  handleMediaDragStart,
  handleMediaDragEnd,
  handleFolderDragStart,
  handleFolderDragEnd,
  handleFolderDragOver,
  handleFolderDragLeave,
  handleRootDragOver,
  handleRootDragLeave,
  handleFolderDrop,
} = useMedia(searchQuery, sortBy, sortOrder, mediaType);

// === MODALS ===
const showDetail = ref<Media | null>(null);
const showNewFolder = ref(false);
const showEditFolder = ref<FolderNode | null>(null);
const showMoveModal = ref(false);

// Folder form
const newFolderName = ref('');
const newFolderParent = ref<string | null>(null);
const editFolderName = ref('');
const editFolderParent = ref<string | null>(null);
const moveTargetFolder = ref<string | null>(null);

// Context menu
const contextMenu = ref<ContextMenuState | null>(null);

// Confirm modal
const confirmModal = ref<{
  open: boolean;
  title: string;
  message: string;
  action: (() => Promise<void>) | null;
}>({
  open: false,
  title: '',
  message: '',
  action: null,
});

const contextMenuItems: ContextMenuItem[] = [
  { id: 'view', label: 'Voir les details' },
  { id: 'move', label: 'Deplacer vers...' },
  { id: 'download', label: 'Telecharger', href: '', download: true },
  { id: 'separator', label: '', separator: true },
  { id: 'delete', label: 'Supprimer', variant: 'danger' },
];

// === LIFECYCLE ===
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  refresh();
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

watch([currentFolder, searchQuery, sortBy, sortOrder, mediaType], () => {
  selectedItems.value.clear();
  loadMedia();
});

// === ACTIONS ===
async function refresh() {
  await Promise.all([loadFolders(), loadMedia()]);
}

function handleNavigate(folderId: string | null) {
  navigateToFolder(folderId);
  searchQuery.value = '';
}

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    searchInputRef.value?.focus();
  }
  if (e.key === 'Escape') {
    if (contextMenu.value) contextMenu.value = null;
    else if (showDetail.value) showDetail.value = null;
    else if (showMoveModal.value) showMoveModal.value = false;
    else if (showNewFolder.value) showNewFolder.value = false;
    else if (showEditFolder.value) showEditFolder.value = null;
    else selectedItems.value.clear();
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItems.value.size > 0 && !showDetail.value) {
    e.preventDefault();
    handleDeleteSelected();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !showDetail.value) {
    e.preventDefault();
    selectAll();
  }
}

// Context menu
function handleContextMenu(event: MouseEvent, item: Media) {
  event.preventDefault();
  event.stopPropagation();
  if (!selectedItems.value.has(item.id)) {
    selectedItems.value.clear();
    selectedItems.value.add(item.id);
  }
  contextMenu.value = { x: event.clientX, y: event.clientY, item };
}

function handleContextMenuSelect(id: string) {
  if (!contextMenu.value?.item) return;
  switch (id) {
    case 'view':
      showDetail.value = contextMenu.value.item;
      break;
    case 'move':
      openMoveModal();
      break;
    case 'delete':
      handleDeleteSelected();
      break;
  }
  contextMenu.value = null;
}

// Upload
async function handleDrop(e: DragEvent) {
  e.preventDefault();
  dragOver.value = false;
  const files = e.dataTransfer?.files;
  if (!files?.length) return;
  uploading.value = true;
  await uploadFiles(files, currentFolder.value);
  uploading.value = false;
}

async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;
  uploading.value = true;
  await uploadFiles(input.files, currentFolder.value);
  uploading.value = false;
  input.value = '';
}

// Folder operations
function openNewFolder() {
  newFolderParent.value = currentFolder.value;
  newFolderName.value = '';
  showNewFolder.value = true;
}

async function handleCreateFolder() {
  if (!newFolderName.value.trim()) return;
  await createFolder(newFolderName.value.trim(), newFolderParent.value);
  showNewFolder.value = false;
}

function openEditFolder(folder: FolderNode, event: Event) {
  event.stopPropagation();
  showEditFolder.value = folder;
  editFolderName.value = folder.name;
  editFolderParent.value = folder.parent;
}

async function handleSaveFolder() {
  if (!showEditFolder.value || !editFolderName.value.trim()) return;
  await updateFolder(showEditFolder.value.id, editFolderName.value.trim(), editFolderParent.value);
  showEditFolder.value = null;
}

function handleDeleteFolder(id: string, event: Event) {
  event.stopPropagation();
  confirmModal.value = {
    open: true,
    title: 'Supprimer le dossier',
    message: 'Supprimer ce dossier ? Les fichiers seront déplacés vers le parent.',
    action: async () => {
      await deleteFolderApi(id);
      await loadMedia();
    },
  };
}

// Media operations
function openMoveModal() {
  moveTargetFolder.value = currentFolder.value;
  showMoveModal.value = true;
  contextMenu.value = null;
}

async function handleMoveSelected() {
  if (!selectedItems.value.size) return;
  await moveMediaBatch(Array.from(selectedItems.value), moveTargetFolder.value);
  showMoveModal.value = false;
  selectedItems.value.clear();
}

function handleDeleteSelected() {
  if (!selectedItems.value.size) return;
  const count = selectedItems.value.size;
  const ids = Array.from(selectedItems.value);
  confirmModal.value = {
    open: true,
    title: 'Supprimer les fichiers',
    message: `Supprimer ${count} fichier(s) ? Cette action est irréversible.`,
    action: async () => {
      await deleteMediaBatch(ids);
      selectedItems.value.clear();
      contextMenu.value = null;
    },
  };
}

async function handleSaveDetail(data: { title: string; description: string; alt: string }) {
  if (!showDetail.value) return;
  const updated = await updateMedia(showDetail.value.id, {
    title: data.title || undefined,
    description: data.description || undefined,
    alt: data.alt || undefined,
  });
  if (updated) showDetail.value = updated;
}

async function handleDeleteDetail(id: string) {
  await deleteMedia(id);
  showDetail.value = null;
}

function closeContextMenu() {
  contextMenu.value = null;
}

async function handleConfirmAction() {
  if (confirmModal.value.action) {
    await confirmModal.value.action();
  }
  confirmModal.value = { open: false, title: '', message: '', action: null };
}

function handleCancelConfirm() {
  confirmModal.value = { open: false, title: '', message: '', action: null };
}
</script>

<template>
  <div
    class="h-[calc(100vh-8rem)] flex"
    @click="closeContextMenu"
  >
    <!-- Sidebar -->
    <FolderSidebar
      :folders="flatFolderList"
      :current-folder="currentFolder"
      :drop-target-folder-id="dropTargetFolderId"
      :dragged-folder-id="draggedFolderId"
      :is-dragging-to-root="isDraggingToRoot"
      @navigate="handleNavigate"
      @new-folder="openNewFolder"
      @edit-folder="openEditFolder"
      @delete-folder="handleDeleteFolder"
      @folder-drag-start="handleFolderDragStart"
      @folder-drag-end="handleFolderDragEnd"
      @folder-drag-over="handleFolderDragOver"
      @folder-drag-leave="handleFolderDragLeave"
      @folder-drop="handleFolderDrop"
      @root-drag-over="handleRootDragOver"
      @root-drag-leave="handleRootDragLeave"
    />

    <!-- Main content -->
    <div class="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <!-- Toolbar -->
      <div class="bg-white border-b border-gray-200 px-4 py-3">
        <div class="flex items-center gap-3">
          <Breadcrumb
            :items="breadcrumb"
            @navigate="handleNavigate"
          />
          <div class="flex-1" />
          <SearchInput
            ref="searchInputRef"
            v-model="searchQuery"
            placeholder="Rechercher... (⌘K)"
          />

          <!-- Type filter -->
          <select
            v-model="mediaType"
            class="px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">
              Tous
            </option>
            <option value="images">
              Images
            </option>
            <option value="pdf">
              PDF
            </option>
            <option value="documents">
              Documents
            </option>
          </select>

          <!-- Sort -->
          <select
            v-model="sortBy"
            class="px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="date">
              Date
            </option>
            <option value="name">
              Nom
            </option>
            <option value="size">
              Taille
            </option>
          </select>

          <button
            class="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
            @click="sortOrder = sortOrder === 'desc' ? 'asc' : 'desc'"
          >
            <ChevronDownIcon
              v-if="sortOrder === 'desc'"
              size="sm"
            />
            <ChevronUpIcon
              v-else
              size="sm"
            />
          </button>

          <ViewToggle v-model="viewMode" />
          <GridSizeToggle
            v-if="viewMode === 'grid'"
            v-model="gridSize"
          />

          <!-- Upload -->
          <label class="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition cursor-pointer text-sm font-medium">
            <span v-if="uploading">Import...</span>
            <span v-else>Importer</span>
            <input
              type="file"
              multiple
              class="hidden"
              :disabled="uploading"
              @change="handleFileSelect"
            />
          </label>
        </div>

        <!-- Bulk actions -->
        <div
          v-if="selectedItems.size > 0"
          class="mt-2 flex items-center gap-3 text-sm"
        >
          <span class="text-gray-600">{{ selectedItems.size }} selectionne(s)</span>
          <button
            class="text-blue-600 hover:text-blue-800"
            @click="selectAll"
          >
            {{ selectedItems.size === mediaItems.length ? 'Tout deselectionner' : 'Tout selectionner' }}
          </button>
          <Button
            size="sm"
            @click="openMoveModal"
          >
            Deplacer
          </Button>
          <Button
            size="sm"
            variant="danger"
            @click="handleDeleteSelected"
          >
            Supprimer
          </Button>
        </div>
      </div>

      <!-- Content area -->
      <div
        class="flex-1 overflow-auto p-4"
        :class="dragOver ? 'bg-blue-50' : ''"
        @click="clearSelection"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop="handleDrop"
      >
        <div
          v-if="loading"
          class="flex items-center justify-center h-full text-gray-500"
        >
          Chargement...
        </div>

        <div
          v-else-if="mediaItems.length === 0"
          class="flex flex-col items-center justify-center h-full text-gray-400"
        >
          <ImageIcon
            size="lg"
            class="w-16 h-16 mb-4"
          />
          <p v-if="searchQuery">
            Aucun resultat pour "{{ searchQuery }}"
          </p>
          <p v-else>
            Glissez des fichiers ici ou cliquez sur "Importer"
          </p>
        </div>

        <!-- Grid view -->
        <MediaGrid
          v-else-if="viewMode === 'grid'"
          :items="mediaItems"
          :selected-ids="selectedItems"
          :dragging-ids="draggedMediaIds"
          :grid-size="gridSize"
          @item-click="handleItemClick"
          @item-dblclick="showDetail = $event"
          @item-contextmenu="handleContextMenu"
          @checkbox-click="handleCheckboxClick"
          @dragstart="handleMediaDragStart"
          @dragend="handleMediaDragEnd"
        />

        <!-- List view -->
        <MediaList
          v-else
          :items="mediaItems"
          :selected-ids="selectedItems"
          :dragging-ids="draggedMediaIds"
          @item-click="handleItemClick"
          @item-dblclick="showDetail = $event"
          @item-contextmenu="handleContextMenu"
          @checkbox-click="handleCheckboxClick"
          @dragstart="handleMediaDragStart"
          @dragend="handleMediaDragEnd"
        />
      </div>
    </div>

    <!-- Context Menu -->
    <ContextMenu
      v-if="contextMenu"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenuItems.map(item =>
        item.id === 'download' && contextMenu?.item
          ? { ...item, href: getMediaUrl(contextMenu.item) }
          : item
      )"
      @select="handleContextMenuSelect"
      @close="closeContextMenu"
    >
      <template #icon-view>
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      </template>
      <template #icon-move>
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      </template>
      <template #icon-download>
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      </template>
      <template #icon-delete>
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </template>
    </ContextMenu>

    <!-- Detail Modal -->
    <MediaDetailModal
      v-if="showDetail"
      :media="showDetail"
      @close="showDetail = null"
      @save="handleSaveDetail"
      @delete="handleDeleteDetail"
    />

    <!-- New Folder Modal -->
    <Modal
      v-if="showNewFolder"
      title="Nouveau dossier"
      @close="showNewFolder = false"
    >
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Nom</label>
          <input
            v-model="newFolderName"
            type="text"
            placeholder="Nom du dossier"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            autofocus
            @keyup.enter="handleCreateFolder"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Dossier parent</label>
          <select
            v-model="newFolderParent"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option :value="null">
              Racine
            </option>
            <option
              v-for="f in flatFolderList"
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
          <Button @click="showNewFolder = false">
            Annuler
          </Button>
          <Button
            variant="primary"
            @click="handleCreateFolder"
          >
            Creer
          </Button>
        </div>
      </template>
    </Modal>

    <!-- Edit Folder Modal -->
    <Modal
      v-if="showEditFolder"
      title="Modifier le dossier"
      @close="showEditFolder = null"
    >
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Nom</label>
          <input
            v-model="editFolderName"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            autofocus
            @keyup.enter="handleSaveFolder"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Dossier parent</label>
          <select
            v-model="editFolderParent"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option :value="null">
              Racine
            </option>
            <option
              v-for="f in getValidParentOptions(showEditFolder.id)"
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
          <Button @click="showEditFolder = null">
            Annuler
          </Button>
          <Button
            variant="primary"
            @click="handleSaveFolder"
          >
            Enregistrer
          </Button>
        </div>
      </template>
    </Modal>

    <!-- Move Modal -->
    <Modal
      v-if="showMoveModal"
      :title="`Deplacer ${selectedItems.size} fichier(s)`"
      @close="showMoveModal = false"
    >
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Dossier de destination</label>
        <select
          v-model="moveTargetFolder"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option :value="null">
            Racine
          </option>
          <option
            v-for="f in flatFolderList"
            :key="f.id"
            :value="f.id"
          >
            {{ '\u2014'.repeat(f.level) }} {{ f.name }}
          </option>
        </select>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button @click="showMoveModal = false">
            Annuler
          </Button>
          <Button
            variant="primary"
            @click="handleMoveSelected"
          >
            Deplacer
          </Button>
        </div>
      </template>
    </Modal>

    <!-- Confirm Modal -->
    <ConfirmModal
      :open="confirmModal.open"
      :title="confirmModal.title"
      :message="confirmModal.message"
      confirm-label="Supprimer"
      @confirm="handleConfirmAction"
      @cancel="handleCancelConfirm"
    />
  </div>
</template>
