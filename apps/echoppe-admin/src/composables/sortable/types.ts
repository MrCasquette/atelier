// Position de drop pour listes plates
export type FlatDropPosition = 'before' | 'after';

// Position de drop pour arbres (avec possibilité d'imbriquer)
export type TreeDropPosition = 'before' | 'inside' | 'after';

// État générique du drag & drop
export interface SortableState {
  draggedId: string | null;
  dropTargetId: string | null;
  dropPosition: FlatDropPosition | TreeDropPosition | null;
}

// Options de configuration pour listes plates
export interface UseSortableOptions {
  /** Attribut data pour identifier la zone de drop */
  dropZoneAttr?: string;
  /** Mode arbre (ajoute position "inside") */
  treeMode?: boolean;
  /** Callback appelé lors du drop */
  onReorder: (_draggedId: string, _targetId: string, _position: FlatDropPosition) => void | Promise<void>;
  /** Validation personnalisée du drop (ex: éviter les cycles dans un arbre) */
  isValidDrop?: (_draggedId: string, _targetId: string) => boolean;
}

// Options de configuration pour arbres
export interface UseTreeSortableOptions {
  /** Attribut data pour identifier la zone de drop */
  dropZoneAttr?: string;
  /** Callback appelé lors du drop */
  onReorder: (_draggedId: string, _targetId: string, _position: TreeDropPosition) => void | Promise<void>;
  /** Validation personnalisée du drop (ex: éviter les cycles dans un arbre) */
  isValidDrop?: (_draggedId: string, _targetId: string) => boolean;
}

// Item avec sortOrder pour le calcul de réordonnancement
export interface SortableItem {
  id: string;
  sortOrder: number;
}

// Résultat du calcul de réordonnancement
export interface ReorderResult {
  id: string;
  sortOrder: number;
}
