// Position de drop pour listes plates
export type FlatDropPosition = 'before' | 'after';

// Position de drop pour arbres (avec possibilité d'imbriquer)
export type TreeDropPosition = 'before' | 'inside' | 'after';

// État du drag & drop, paramétré par les positions que le mode accepte.
//
// L'union des deux modes obligeait à réaffirmer la position au moment de la rendre — et masquait
// qu'une liste plate ne peut PAS recevoir `inside`. Le paramètre le dit, et le compilateur le tient.
export interface SortableState<P extends FlatDropPosition | TreeDropPosition = TreeDropPosition> {
  draggedId: string | null;
  dropTargetId: string | null;
  dropPosition: P | null;
}

// Options de configuration pour listes plates
export interface UseSortableOptions {
  /** Attribut data pour identifier la zone de drop */
  dropZoneAttr?: string;
  /** Jamais vrai ici : c'est ce qui distingue les deux modes à l'appel. */
  treeMode?: false;
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
