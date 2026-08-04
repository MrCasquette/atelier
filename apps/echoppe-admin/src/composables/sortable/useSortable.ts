/* eslint-disable no-redeclare */
import { ref, computed } from 'vue';
import type {
  SortableState,
  FlatDropPosition,
  UseSortableOptions,
  UseTreeSortableOptions,
  SortableItem,
  ReorderResult,
} from './types';

// Surcharge pour liste plate
export function useSortable(_options: UseSortableOptions): ReturnType<typeof createSortable>;
// Surcharge pour arbre
export function useSortable(_options: UseTreeSortableOptions & { treeMode: true }): ReturnType<typeof createTreeSortable>;
// Implémentation
export function useSortable(
  options: UseSortableOptions | (UseTreeSortableOptions & { treeMode: true })
): ReturnType<typeof createSortable> | ReturnType<typeof createTreeSortable> {
  if ('treeMode' in options && options.treeMode) {
    return createTreeSortable(options as UseTreeSortableOptions & { treeMode: true });
  }
  return createSortable(options as UseSortableOptions);
}

function createSortable(options: UseSortableOptions) {
  const {
    dropZoneAttr = 'data-sortable-drop',
    onReorder,
    isValidDrop,
  } = options;

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const dragState = ref<SortableState>({
    draggedId: null,
    dropTargetId: null,
    dropPosition: null,
  });

  // ---------------------------------------------------------------------------
  // COMPUTED
  // ---------------------------------------------------------------------------
  const isDragging = computed(() => dragState.value.draggedId !== null);

  const draggedId = computed(() => dragState.value.draggedId);
  const dropTargetId = computed(() => dragState.value.dropTargetId);
  const dropPosition = computed(() => dragState.value.dropPosition);

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  function getDropPosition(e: DragEvent): FlatDropPosition {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    return y < height / 2 ? 'before' : 'after';
  }

  function resetState() {
    dragState.value = {
      draggedId: null,
      dropTargetId: null,
      dropPosition: null,
    };
  }

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  function handleDragStart(e: DragEvent, itemId: string) {
    dragState.value.draggedId = itemId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', itemId);
    }
  }

  function handleDragOver(e: DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();

    if (!dragState.value.draggedId || dragState.value.draggedId === targetId) {
      return;
    }

    // Validation personnalisée
    if (isValidDrop && !isValidDrop(dragState.value.draggedId, targetId)) {
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'none';
      }
      return;
    }

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }

    const position = getDropPosition(e);
    dragState.value.dropTargetId = targetId;
    dragState.value.dropPosition = position;
  }

  function handleDragLeave(e: DragEvent) {
    // Ne reset que si on quitte vraiment la zone de drop
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest(`[${dropZoneAttr}]`)) {
      dragState.value.dropTargetId = null;
      dragState.value.dropPosition = null;
    }
  }

  async function handleDrop(e: DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();

    const draggedId = dragState.value.draggedId;
    const position = dragState.value.dropPosition;

    if (!draggedId || draggedId === targetId || !position) {
      resetState();
      return;
    }

    // Validation personnalisée
    if (isValidDrop && !isValidDrop(draggedId, targetId)) {
      resetState();
      return;
    }

    await onReorder(draggedId, targetId, position as FlatDropPosition);
    resetState();
  }

  function handleDragEnd() {
    resetState();
  }

  // ---------------------------------------------------------------------------
  // UTILS - Calcul du nouvel ordre pour listes plates
  // ---------------------------------------------------------------------------
  function calculateNewOrder<I extends SortableItem>(
    items: I[],
    draggedId: string,
    targetId: string,
    position: FlatDropPosition
  ): ReorderResult[] {
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

    const draggedIndex = sorted.findIndex((item) => item.id === draggedId);
    let targetIndex = sorted.findIndex((item) => item.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return [];

    // Retirer l'élément dragué
    const [draggedItem] = sorted.splice(draggedIndex, 1);

    // Ajuster l'index cible si nécessaire
    if (position === 'after') {
      targetIndex = sorted.findIndex((item) => item.id === targetId) + 1;
    } else {
      targetIndex = sorted.findIndex((item) => item.id === targetId);
    }

    // Insérer à la nouvelle position
    sorted.splice(targetIndex, 0, draggedItem);

    // Retourner les nouveaux sortOrder
    return sorted.map((item, index) => ({
      id: item.id,
      sortOrder: index,
    }));
  }

  // ---------------------------------------------------------------------------
  // ITEM STATE HELPERS (pour le template)
  // ---------------------------------------------------------------------------
  function isItemDragging(itemId: string): boolean {
    return dragState.value.draggedId === itemId;
  }

  function isDropTarget(itemId: string): boolean {
    return (
      dragState.value.dropTargetId === itemId &&
      dragState.value.draggedId !== itemId
    );
  }

  function getItemDropPosition(itemId: string): FlatDropPosition | TreeDropPosition | null {
    if (!isDropTarget(itemId)) return null;
    return dragState.value.dropPosition;
  }

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------
  return {
    // State
    dragState,
    isDragging,
    draggedId,
    dropTargetId,
    dropPosition,

    // Handlers
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,

    // Utils
    calculateNewOrder,
    resetState,

    // Item helpers
    isItemDragging,
    isDropTarget,
    getItemDropPosition,

    // Config
    dropZoneAttr,
  };
}

// ---------------------------------------------------------------------------
// VERSION ARBRE (avec position "inside")
// ---------------------------------------------------------------------------
import type { TreeDropPosition } from './types';

function createTreeSortable(options: UseTreeSortableOptions & { treeMode: true }) {
  const {
    dropZoneAttr = 'data-sortable-drop',
    onReorder,
    isValidDrop,
  } = options;

  const dragState = ref<SortableState>({
    draggedId: null,
    dropTargetId: null,
    dropPosition: null,
  });

  const isDragging = computed(() => dragState.value.draggedId !== null);
  const draggedId = computed(() => dragState.value.draggedId);
  const dropTargetId = computed(() => dragState.value.dropTargetId);
  const dropPosition = computed(() => dragState.value.dropPosition);

  function getDropPosition(e: DragEvent): TreeDropPosition {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    // Mode arbre : 25% haut = before, 50% milieu = inside, 25% bas = after
    if (y < height * 0.25) return 'before';
    if (y > height * 0.75) return 'after';
    return 'inside';
  }

  function resetState() {
    dragState.value = {
      draggedId: null,
      dropTargetId: null,
      dropPosition: null,
    };
  }

  function handleDragStart(e: DragEvent, itemId: string) {
    dragState.value.draggedId = itemId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', itemId);
    }
  }

  // Surcharge : position auto-calculée ou passée en paramètre
  function handleDragOver(e: DragEvent, targetId: string, position?: TreeDropPosition) {
    e.preventDefault();
    e.stopPropagation();

    if (!dragState.value.draggedId || dragState.value.draggedId === targetId) {
      return;
    }

    if (isValidDrop && !isValidDrop(dragState.value.draggedId, targetId)) {
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'none';
      }
      return;
    }

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }

    const finalPosition = position ?? getDropPosition(e);
    dragState.value.dropTargetId = targetId;
    dragState.value.dropPosition = finalPosition;
  }

  function handleDragLeave(e: DragEvent) {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest(`[${dropZoneAttr}]`)) {
      dragState.value.dropTargetId = null;
      dragState.value.dropPosition = null;
    }
  }

  // Surcharge : position depuis state ou passée en paramètre
  async function handleDrop(e: DragEvent, targetId: string, position?: TreeDropPosition) {
    e.preventDefault();
    e.stopPropagation();

    const draggedId = dragState.value.draggedId;
    const finalPosition = position ?? dragState.value.dropPosition;

    if (!draggedId || draggedId === targetId || !finalPosition) {
      resetState();
      return;
    }

    if (isValidDrop && !isValidDrop(draggedId, targetId)) {
      resetState();
      return;
    }

    await onReorder(draggedId, targetId, finalPosition as TreeDropPosition);
    resetState();
  }

  function handleDragEnd() {
    resetState();
  }

  function isItemDragging(itemId: string): boolean {
    return dragState.value.draggedId === itemId;
  }

  function isDropTarget(itemId: string): boolean {
    return (
      dragState.value.dropTargetId === itemId &&
      dragState.value.draggedId !== itemId
    );
  }

  function getItemDropPosition(itemId: string): TreeDropPosition | null {
    if (!isDropTarget(itemId)) return null;
    return dragState.value.dropPosition as TreeDropPosition | null;
  }

  return {
    dragState,
    isDragging,
    draggedId,
    dropTargetId,
    dropPosition,
    getDropPosition,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    resetState,
    isItemDragging,
    isDropTarget,
    getItemDropPosition,
    dropZoneAttr,
  };
}
