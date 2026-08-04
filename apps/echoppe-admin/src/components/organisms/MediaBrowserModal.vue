<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import {
  type Media,
  type ViewMode,
  type GridSize,
  type SortBy,
  type SortOrder,
  useMedia,
  getMediaUrl,
  isImage,
} from '@/composables/media';
import Modal from '@/components/atoms/Modal.vue';
import Button from '@/components/atoms/Button.vue';
import ChevronDownIcon from '@/components/atoms/icons/ChevronDownIcon.vue';
import ChevronUpIcon from '@/components/atoms/icons/ChevronUpIcon.vue';
import ImageIcon from '@/components/atoms/icons/ImageIcon.vue';
import CheckIcon from '@/components/atoms/icons/CheckIcon.vue';
import FolderIcon from '@/components/atoms/icons/FolderIcon.vue';
import ChevronRightIcon from '@/components/atoms/icons/ChevronRightIcon.vue';
import SearchInput from '@/components/molecules/SearchInput.vue';
import ViewToggle from '@/components/molecules/ViewToggle.vue';
import GridSizeToggle from '@/components/molecules/GridSizeToggle.vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    accept?: 'images' | 'all';
    defaultUploadFolder?: string;
    onSelect?: (_media: Media) => void;
    onClose?: () => void;
  }>(),
  {
    title: 'Sélectionner un média',
    accept: 'images',
    defaultUploadFolder: undefined,
    onSelect: undefined,
    onClose: undefined,
  }
);

// UI State
const viewMode = ref<ViewMode>('grid');
const gridSize = ref<GridSize>('medium');
const searchQuery = ref('');
const sortBy = ref<SortBy>('date');
const sortOrder = ref<SortOrder>('desc');
const uploading = ref(false);
const dragOver = ref(false);
const selectedMedia = ref<Media | null>(null);

// Composable
const {
  currentFolder,
  mediaItems,
  loading,
  flatFolderList,
  breadcrumb,
  loadFolders,
  navigateToFolder,
  loadMedia,
  uploadFiles,
} = useMedia(searchQuery, sortBy, sortOrder);

// Filtered media based on accept prop
const filteredMedia = computed(() => {
  if (props.accept === 'images') {
    return mediaItems.value.filter((m) => isImage(m));
  }
  return mediaItems.value;
});

// Grid size classes
const gridSizeClasses = {
  small: 'grid-cols-6 gap-2',
  medium: 'grid-cols-5 gap-3',
  large: 'grid-cols-4 gap-4',
};

const itemSizeClasses = {
  small: 'aspect-square',
  medium: 'aspect-square',
  large: 'aspect-square',
};

// Load on mount
onMounted(async () => {
  await Promise.all([loadFolders(), loadMedia()]);
});

watch([currentFolder, searchQuery, sortBy, sortOrder], () => {
  selectedMedia.value = null;
  loadMedia();
});

// Navigation
function handleNavigate(folderId: string | null) {
  navigateToFolder(folderId);
  searchQuery.value = '';
}

// Selection
function handleSelect(item: Media) {
  selectedMedia.value = item;
}

function confirmSelection() {
  if (selectedMedia.value) {
    props.onSelect?.(selectedMedia.value);
  }
}

// Upload
async function handleDrop(e: DragEvent) {
  e.preventDefault();
  dragOver.value = false;
  const files = e.dataTransfer?.files;
  if (!files?.length) return;
  uploading.value = true;
  const result = await uploadFiles(files, currentFolder.value, props.defaultUploadFolder);
  // Présélectionner le premier média uploadé
  if (result.mediaIds.length > 0) {
    const uploadedMedia = mediaItems.value.find(m => m.id === result.mediaIds[0]);
    if (uploadedMedia) selectedMedia.value = uploadedMedia;
  }
  uploading.value = false;
}

async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;
  uploading.value = true;
  const result = await uploadFiles(input.files, currentFolder.value, props.defaultUploadFolder);
  // Présélectionner le premier média uploadé
  if (result.mediaIds.length > 0) {
    const uploadedMedia = mediaItems.value.find(m => m.id === result.mediaIds[0]);
    if (uploadedMedia) selectedMedia.value = uploadedMedia;
  }
  uploading.value = false;
  input.value = '';
}
</script>

<template>
  <Modal
    :title="title"
    size="2xl"
    tall
    @close="onClose?.()"
  >
    <div class="flex h-full -m-5">
      <!-- Sidebar: Folders -->
      <div class="w-48 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div class="p-3 border-b border-gray-200">
          <span class="text-xs font-medium text-gray-500 uppercase">Dossiers</span>
        </div>
        <div class="flex-1 overflow-auto p-2">
          <button
            :class="[
              'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition',
              currentFolder === null
                ? 'bg-blue-100 text-blue-700'
                : 'hover:bg-gray-100 text-gray-700',
            ]"
            @click="handleNavigate(null)"
          >
            <FolderIcon size="sm" />
            <span>Tous les médias</span>
          </button>
          <button
            v-for="folder in flatFolderList"
            :key="folder.id"
            :style="{ paddingLeft: `${(folder.level + 1) * 12}px` }"
            :class="[
              'w-full flex items-center gap-2 py-1.5 pr-2 rounded text-sm text-left transition',
              currentFolder === folder.id
                ? 'bg-blue-100 text-blue-700'
                : 'hover:bg-gray-100 text-gray-700',
            ]"
            @click="handleNavigate(folder.id)"
          >
            <FolderIcon size="sm" />
            <span class="truncate">{{ folder.name }}</span>
          </button>
        </div>
      </div>

      <!-- Main content -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Toolbar -->
        <div class="border-b border-gray-200 px-4 py-2 flex items-center gap-3 bg-white">
          <!-- Breadcrumb -->
          <div class="flex items-center gap-1 text-sm text-gray-600">
            <button
              class="hover:text-blue-600 transition"
              @click="handleNavigate(null)"
            >
              Médias
            </button>
            <template
              v-for="(item, index) in breadcrumb"
              :key="item.id"
            >
              <ChevronRightIcon
                size="xs"
                class="text-gray-400"
              />
              <button
                :class="[
                  'transition',
                  index === breadcrumb.length - 1
                    ? 'text-gray-900 font-medium'
                    : 'hover:text-blue-600',
                ]"
                @click="handleNavigate(item.id)"
              >
                {{ item.name }}
              </button>
            </template>
          </div>

          <div class="flex-1" />

          <SearchInput
            v-model="searchQuery"
            placeholder="Rechercher..."
            class="w-48"
          />

          <select
            v-model="sortBy"
            class="px-2 py-1 border border-gray-300 rounded text-sm"
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
            class="p-1 border border-gray-300 rounded hover:bg-gray-50"
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
          <label
            class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition cursor-pointer text-sm font-medium"
          >
            <span v-if="uploading">Import...</span>
            <span v-else>Importer</span>
            <input
              type="file"
              multiple
              :accept="accept === 'images' ? 'image/*' : undefined"
              class="hidden"
              :disabled="uploading"
              @change="handleFileSelect"
            />
          </label>
        </div>

        <!-- Content -->
        <div
          class="flex-1 overflow-auto p-4"
          :class="dragOver ? 'bg-blue-50' : 'bg-gray-50'"
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
            v-else-if="filteredMedia.length === 0"
            class="flex flex-col items-center justify-center h-full text-gray-400"
          >
            <ImageIcon
              size="lg"
              class="w-12 h-12 mb-3"
            />
            <p v-if="searchQuery">
              Aucun résultat pour "{{ searchQuery }}"
            </p>
            <p v-else>
              Glissez des fichiers ici ou cliquez sur "Importer"
            </p>
          </div>

          <!-- Grid view -->
          <div
            v-else-if="viewMode === 'grid'"
            :class="['grid', gridSizeClasses[gridSize]]"
          >
            <button
              v-for="item in filteredMedia"
              :key="item.id"
              :class="[
                'relative bg-white rounded-lg overflow-hidden border-2 transition group',
                itemSizeClasses[gridSize],
                selectedMedia?.id === item.id
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-transparent hover:border-gray-300',
              ]"
              @click="handleSelect(item)"
              @dblclick="selectedMedia = item; confirmSelection()"
            >
              <img
                v-if="isImage(item)"
                :src="getMediaUrl(item)"
                :alt="item.alt || item.filenameOriginal"
                class="w-full h-full object-cover"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center bg-gray-100"
              >
                <ImageIcon
                  size="lg"
                  class="text-gray-400"
                />
              </div>
              <!-- Selection indicator -->
              <div
                v-if="selectedMedia?.id === item.id"
                class="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"
              >
                <CheckIcon
                  size="sm"
                  class="text-white"
                />
              </div>
              <!-- Filename on hover -->
              <div
                class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition"
              >
                <p class="text-white text-xs truncate">
                  {{ item.title || item.filenameOriginal }}
                </p>
              </div>
            </button>
          </div>

          <!-- List view -->
          <div
            v-else
            class="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            <table class="w-full">
              <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th class="px-4 py-2 text-left">
                    Aperçu
                  </th>
                  <th class="px-4 py-2 text-left">
                    Nom
                  </th>
                  <th class="px-4 py-2 text-left">
                    Type
                  </th>
                  <th class="px-4 py-2 text-left">
                    Taille
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="item in filteredMedia"
                  :key="item.id"
                  :class="[
                    'cursor-pointer transition',
                    selectedMedia?.id === item.id
                      ? 'bg-blue-50'
                      : 'hover:bg-gray-50',
                  ]"
                  @click="handleSelect(item)"
                  @dblclick="selectedMedia = item; confirmSelection()"
                >
                  <td class="px-4 py-2">
                    <div class="w-10 h-10 bg-gray-100 rounded overflow-hidden">
                      <img
                        v-if="isImage(item)"
                        :src="getMediaUrl(item)"
                        class="w-full h-full object-cover"
                      />
                    </div>
                  </td>
                  <td class="px-4 py-2 text-sm">
                    {{ item.title || item.filenameOriginal }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-500">
                    {{ item.mimeType }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-500">
                    {{ Math.round(item.size / 1024) }} Ko
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-500">
          <span v-if="selectedMedia">
            Sélectionné : {{ selectedMedia.title || selectedMedia.filenameOriginal }}
          </span>
          <span v-else>Cliquez sur un média pour le sélectionner</span>
        </div>
        <div class="flex gap-2">
          <Button
            variant="secondary"
            @click="onClose?.()"
          >
            Annuler
          </Button>
          <Button
            variant="primary"
            :disabled="!selectedMedia"
            @click="confirmSelection"
          >
            Sélectionner
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>
