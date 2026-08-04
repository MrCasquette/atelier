import { ref, computed, type Ref } from 'vue';
import { api } from '@/lib/api';
import type { Folder, FolderNode, Media, SortBy, SortOrder, MediaType } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7532';

// =============================================================================
// UTILS
// =============================================================================

export function getMediaUrl(item: Media): string {
  return `${API_URL}/assets/${item.id}`;
}

export function isImage(item: Media): boolean {
  return item.mimeType.startsWith('image/');
}

export function isPdf(item: Media): boolean {
  return item.mimeType === 'application/pdf';
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// =============================================================================
// MAIN COMPOSABLE
// =============================================================================

export function useMedia(
  searchQuery: Ref<string>,
  sortBy: Ref<SortBy>,
  sortOrder: Ref<SortOrder>,
  mediaType: Ref<MediaType> = ref('all')
) {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const folders = ref<Folder[]>([]);
  const currentFolder = ref<string | null>(null);
  const mediaItems = ref<Media[]>([]);
  const loading = ref(true);
  const selectedItems = ref<Set<string>>(new Set());

  // Drag & drop state
  const draggedMediaIds = ref<string[]>([]);
  const draggedFolderId = ref<string | null>(null);
  const dropTargetFolderId = ref<string | null>(null);
  const isDraggingToRoot = ref(false);

  // ---------------------------------------------------------------------------
  // COMPUTED - FOLDERS
  // ---------------------------------------------------------------------------
  const folderTree = computed((): FolderNode[] => {
    const buildTree = (parentId: string | null, level: number): FolderNode[] => {
      return folders.value
        .filter(f => f.parent === parentId)
        .map(f => ({ ...f, level, children: buildTree(f.id, level + 1) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    };
    return buildTree(null, 0);
  });

  const flatFolderList = computed((): FolderNode[] => {
    const result: FolderNode[] = [];
    const flatten = (nodes: FolderNode[]) => {
      for (const node of nodes) {
        result.push(node);
        flatten(node.children);
      }
    };
    flatten(folderTree.value);
    return result;
  });

  const currentFolderData = computed(() => folders.value.find(f => f.id === currentFolder.value));

  const breadcrumb = computed(() => {
    const crumbs: { id: string | null; name: string }[] = [];
    let current = currentFolderData.value;
    while (current) {
      crumbs.unshift({ id: current.id, name: current.name });
      current = folders.value.find(f => f.id === current?.parent);
    }
    crumbs.unshift({ id: null, name: 'Mediatheque' });
    return crumbs;
  });

  function getDescendants(folderId: string): Set<string> {
    const descendants = new Set<string>();
    function collect(id: string) {
      descendants.add(id);
      folders.value.filter(f => f.parent === id).forEach(f => collect(f.id));
    }
    collect(folderId);
    return descendants;
  }

  function getValidParentOptions(folderId: string): FolderNode[] {
    const descendants = getDescendants(folderId);
    return flatFolderList.value.filter(f => !descendants.has(f.id));
  }

  // ---------------------------------------------------------------------------
  // API - FOLDERS
  // ---------------------------------------------------------------------------
  async function loadFolders() {
    const { data } = await api.media.folders.get();
    if (data && Array.isArray(data)) folders.value = data;
  }

  async function createFolder(name: string, parent: string | null) {
    await api.media.folders.post({ name, parent });
    await loadFolders();
  }

  async function updateFolder(id: string, name: string, parent: string | null) {
    await api.media.folders({ id }).put({ name, parent });
    await loadFolders();
  }

  async function deleteFolder(id: string) {
    await api.media.folders({ id }).delete();
    if (currentFolder.value === id) currentFolder.value = null;
    await loadFolders();
  }

  function navigateToFolder(folderId: string | null) {
    currentFolder.value = folderId;
  }

  // ---------------------------------------------------------------------------
  // API - MEDIA
  // ---------------------------------------------------------------------------
  async function loadMedia() {
    loading.value = true;
    const query: Record<string, string | number> = { sort: sortBy.value, order: sortOrder.value, limit: 100 };
    if (currentFolder.value) query.folder = currentFolder.value;
    if (searchQuery.value) {
      query.search = searchQuery.value;
      query.all = 'true';
    }
    if (mediaType.value !== 'all') {
      query.type = mediaType.value;
      query.all = 'true';
    }
    const { data } = await api.media.get({ query });
    if (data?.data) mediaItems.value = data.data;
    loading.value = false;
  }

  async function updateMedia(id: string, updates: { title?: string; description?: string; alt?: string }) {
    await api.media({ id }).put(updates);
    const index = mediaItems.value.findIndex(m => m.id === id);
    if (index !== -1) {
      mediaItems.value[index] = {
        ...mediaItems.value[index],
        title: updates.title ?? mediaItems.value[index].title,
        description: updates.description ?? mediaItems.value[index].description,
        alt: updates.alt ?? mediaItems.value[index].alt,
      };
    }
    return mediaItems.value[index];
  }

  async function deleteMedia(id: string): Promise<boolean> {
    try {
      const { error } = await api.media({ id }).delete();
      if (error) return false;
      await loadMedia();
      return true;
    } catch {
      return false;
    }
  }

  async function deleteMediaBatch(ids: string[]): Promise<boolean> {
    try {
      const { error } = await api.media.batch.delete({ ids });
      if (error) return false;
      await loadMedia();
      return true;
    } catch {
      return false;
    }
  }

  async function moveMediaBatch(ids: string[], folder: string | null) {
    await api.media.batch.move.put({ ids, folder });
    await loadMedia();
  }

  interface UploadResult {
    folderId: string | null;
    mediaIds: string[];
  }

  async function uploadFiles(files: FileList, folder: string | null, folderName?: string): Promise<UploadResult> {
    let targetFolderId = folder;
    const mediaIds: string[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      if (folder) formData.append('folder', folder);
      if (folderName && !folder) formData.append('folderName', folderName);

      const response = await fetch(`${API_URL}/media/upload`, { method: 'POST', body: formData, credentials: 'include' });
      const data = await response.json();

      if (data?.id) {
        mediaIds.push(data.id);
      }
      if (!targetFolderId && data?.folder) {
        targetFolderId = data.folder;
      }
    }

    // Recharger dossiers et médias
    await loadFolders();

    // Naviguer vers le dossier cible
    if (targetFolderId) {
      currentFolder.value = targetFolderId;
    }

    await loadMedia();

    return { folderId: targetFolderId, mediaIds };
  }

  // ---------------------------------------------------------------------------
  // SELECTION
  // ---------------------------------------------------------------------------
  function handleItemClick(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (event.shiftKey && selectedItems.value.size > 0) {
      const ids = mediaItems.value.map(m => m.id);
      const lastSelected = Array.from(selectedItems.value).pop()!;
      const lastIndex = ids.indexOf(lastSelected);
      const currentIndex = ids.indexOf(id);
      const [start, end] = lastIndex < currentIndex ? [lastIndex, currentIndex] : [currentIndex, lastIndex];
      for (let i = start; i <= end; i++) selectedItems.value.add(ids[i]);
    } else if (event.ctrlKey || event.metaKey) {
      selectedItems.value.has(id) ? selectedItems.value.delete(id) : selectedItems.value.add(id);
    } else {
      if (selectedItems.value.has(id) && selectedItems.value.size === 1) {
        selectedItems.value.clear();
      } else {
        selectedItems.value.clear();
        selectedItems.value.add(id);
      }
    }
  }

  function handleCheckboxClick(id: string, event: MouseEvent) {
    event.stopPropagation();
    selectedItems.value.has(id) ? selectedItems.value.delete(id) : selectedItems.value.add(id);
  }

  function clearSelection() {
    selectedItems.value.clear();
  }

  function selectAll() {
    if (selectedItems.value.size === mediaItems.value.length) {
      selectedItems.value.clear();
    } else {
      selectedItems.value = new Set(mediaItems.value.map(m => m.id));
    }
  }

  // ---------------------------------------------------------------------------
  // DRAG & DROP
  // ---------------------------------------------------------------------------
  function handleMediaDragStart(e: DragEvent, mediaId: string) {
    if (!selectedItems.value.has(mediaId)) {
      selectedItems.value.clear();
      selectedItems.value.add(mediaId);
    }
    draggedMediaIds.value = Array.from(selectedItems.value);
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', JSON.stringify({ type: 'media', ids: draggedMediaIds.value }));

    const dragImage = document.createElement('div');
    dragImage.className = 'bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium';
    dragImage.textContent = `${draggedMediaIds.value.length} fichier(s)`;
    dragImage.style.cssText = 'position:absolute;top:-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer!.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  }

  function handleMediaDragEnd() {
    draggedMediaIds.value = [];
    dropTargetFolderId.value = null;
    isDraggingToRoot.value = false;
  }

  function handleFolderDragStart(e: DragEvent, folderId: string) {
    draggedFolderId.value = folderId;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', JSON.stringify({ type: 'folder', id: folderId }));

    const folder = folders.value.find(f => f.id === folderId);
    const dragImage = document.createElement('div');
    dragImage.className = 'bg-yellow-500 text-white px-3 py-1 rounded text-sm font-medium';
    dragImage.textContent = folder?.name || 'Dossier';
    dragImage.style.cssText = 'position:absolute;top:-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer!.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  }

  function handleFolderDragEnd() {
    draggedFolderId.value = null;
    dropTargetFolderId.value = null;
    isDraggingToRoot.value = false;
  }

  function handleFolderDragOver(e: DragEvent, folderId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (draggedFolderId.value && getDescendants(draggedFolderId.value).has(folderId)) {
      e.dataTransfer!.dropEffect = 'none';
      return;
    }
    e.dataTransfer!.dropEffect = 'move';
    dropTargetFolderId.value = folderId;
    isDraggingToRoot.value = false;
  }

  function handleFolderDragLeave(e: DragEvent) {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest('[data-folder-drop]')) dropTargetFolderId.value = null;
  }

  function handleRootDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer!.dropEffect = 'move';
    dropTargetFolderId.value = null;
    isDraggingToRoot.value = true;
  }

  function handleRootDragLeave() {
    isDraggingToRoot.value = false;
  }

  async function handleFolderDrop(e: DragEvent, targetFolderId: string | null) {
    e.preventDefault();
    e.stopPropagation();
    dropTargetFolderId.value = null;
    isDraggingToRoot.value = false;

    try {
      const data = JSON.parse(e.dataTransfer!.getData('text/plain'));
      if (data.type === 'media' && data.ids?.length > 0) {
        await moveMediaBatch(data.ids, targetFolderId);
        draggedMediaIds.value = [];
        selectedItems.value.clear();
      } else if (data.type === 'folder' && data.id) {
        const folderToMove = folders.value.find(f => f.id === data.id);
        if (folderToMove && folderToMove.id !== targetFolderId) {
          const descendants = getDescendants(data.id);
          if (!descendants.has(targetFolderId || '')) {
            await updateFolder(data.id, folderToMove.name, targetFolderId);
            draggedFolderId.value = null;
          }
        }
      }
    } catch {
      // Invalid drop data
    }
  }

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------
  return {
    // State
    folders,
    currentFolder,
    mediaItems,
    loading,
    selectedItems,
    draggedMediaIds,
    draggedFolderId,
    dropTargetFolderId,
    isDraggingToRoot,

    // Computed
    folderTree,
    flatFolderList,
    currentFolderData,
    breadcrumb,

    // Folders
    loadFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    navigateToFolder,
    getValidParentOptions,
    getDescendants,

    // Media
    loadMedia,
    updateMedia,
    deleteMedia,
    deleteMediaBatch,
    moveMediaBatch,
    uploadFiles,

    // Selection
    handleItemClick,
    handleCheckboxClick,
    clearSelection,
    selectAll,

    // Drag & Drop
    handleMediaDragStart,
    handleMediaDragEnd,
    handleFolderDragStart,
    handleFolderDragEnd,
    handleFolderDragOver,
    handleFolderDragLeave,
    handleRootDragOver,
    handleRootDragLeave,
    handleFolderDrop,
  };
}
