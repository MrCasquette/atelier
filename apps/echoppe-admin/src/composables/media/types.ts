import { api } from '@/lib/api';
import type { ApiData } from '@/types/api';

// Types inférés depuis Eden (extrait le tableau, exclut les erreurs)
type FoldersResponse = ApiData<ReturnType<typeof api.media.folders.get>>;
type MediaResponse = ApiData<ReturnType<typeof api.media.get>>;

export type Folder = Extract<FoldersResponse, unknown[]>[number];
// MediaResponse est maintenant paginée: { data: Media[], meta: {...} }
export type Media = MediaResponse['data'][number];

// Type dérivé pour l'arbre de dossiers (UI)
export interface FolderNode extends Folder {
  children: FolderNode[];
  level: number;
}

export interface ContextMenuState {
  x: number;
  y: number;
  item: Media | null;
}

export type ViewMode = 'grid' | 'list';
export type GridSize = 'small' | 'medium' | 'large';
export type SortBy = 'date' | 'name' | 'size';
export type SortOrder = 'desc' | 'asc';
export type MediaType = 'all' | 'images' | 'pdf' | 'documents';
