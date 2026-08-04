# Patterns de Code - Dashboard Admin

Guide des conventions architecturales et patterns utilisés dans le projet.

---

## 1. Architecture Atomic Design

```
apps/echoppe-admin/src/components/
├── atoms/           # Composants primitifs (Button, Modal, Checkbox, Thumbnail...)
├── molecules/       # Compositions d'atoms (Breadcrumb, SearchInput, ContextMenu...)
└── organisms/       # Sections complètes (FolderSidebar, MediaGrid, MediaDetailModal...)
```

### Règles

- **Atoms** : Composants génériques, sans logique métier, réutilisables partout
- **Molecules** : Compositions d'atoms avec interface spécifique (ex: `ContextMenuItem`)
- **Organisms** : Sections UI complètes, "dumb components" (props in, events out)
- **Views** : Orchestration des organisms + composables

---

## 2. Composables - Structure Standard

```
composables/
└── [feature]/
    ├── index.ts      # Barrel exports
    ├── types.ts      # Définitions de types
    └── use[Feature].ts  # Logique du composable
```

### Pattern de fichier composable

```typescript
// types.ts - Types inférés depuis Eden API
import { api } from '@/lib/api';

type MediaResponse = NonNullable<Awaited<ReturnType<typeof api.media.get>>['data']>;
export type Media = Extract<MediaResponse, unknown[]>[number];

// Types dérivés pour l'UI
export interface FolderNode extends Folder {
  children: FolderNode[];
  level: number;
}

// Union types pour options
export type ViewMode = 'grid' | 'list';
export type GridSize = 'small' | 'medium' | 'large';
```

```typescript
// use[Feature].ts - Organisation en sections
export function useFeature(param1: Ref<T>, param2: Ref<T>) {
  // === STATE ===
  const items = ref<Item[]>([]);
  const loading = ref(false);
  const selectedItems = ref<Set<string>>(new Set());

  // === COMPUTED ===
  const filteredItems = computed(() => ...);
  const breadcrumb = computed(() => ...);

  // === HELPERS ===
  function getDescendants(id: string): Set<string> { ... }

  // === API OPERATIONS ===
  async function load() { ... }
  async function create(data: CreateInput) { ... }
  async function update(id: string, data: UpdateInput) { ... }
  async function delete(id: string) { ... }

  // === UI HANDLERS ===
  function handleItemClick(id: string, event: MouseEvent) { ... }
  function handleDragStart(e: DragEvent, id: string) { ... }

  return { items, loading, load, create, ... };
}

// Utilitaires purs exportés séparément
export function formatSize(bytes: number): string { ... }
export function formatDate(date: string | Date): string { ... }
```

---

## 3. Types - Inférence Eden (OBLIGATOIRE)

```typescript
// INTERDIT - Types manuels désynchronisés
interface Product {
  id: string;
  name: string;
  dateCreated: string; // Bug potentiel
}

// CORRECT - Types inférés depuis l'API
type ProductsResponse = NonNullable<Awaited<ReturnType<typeof api.products.get>>['data']>;
export type Product = Extract<ProductsResponse, unknown[]>[number];

// Pour routes avec paramètres
type VariantResponse = Awaited<ReturnType<ReturnType<typeof api.products>['variants']['get']>>;
export type Variant = NonNullable<VariantResponse['data']>[number];
```

---

## 4. Composants - Patterns Tailwind

### Variantes via Records

```typescript
// Props
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}>(), {
  variant: 'secondary',
  size: 'md',
});

// Classes mappées
const variantClasses: Record<typeof props.variant, string[]> = {
  primary: ['bg-blue-600', 'text-white', 'hover:bg-blue-700'],
  secondary: ['bg-white', 'border', 'border-gray-300', 'hover:bg-gray-50'],
  danger: ['bg-red-600', 'text-white', 'hover:bg-red-700'],
  ghost: ['bg-transparent', 'hover:bg-gray-100'],
};

const sizeClasses: Record<typeof props.size, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

// Composition
const classes = computed(() => [
  'inline-flex items-center justify-center rounded-lg font-medium transition',
  ...variantClasses[props.variant],
  sizeClasses[props.size],
  props.disabled && 'opacity-50 cursor-not-allowed',
]);
```

### Grid responsive

```typescript
const gridClasses = computed(() => {
  switch (props.gridSize) {
    case 'small':  return 'grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12';
    case 'medium': return 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10';
    case 'large':  return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6';
  }
});
```

---

## 5. Organisms - Pattern "Dumb Components"

```vue
<!-- Organisms reçoivent des props et émettent des events -->
<script setup lang="ts">
import type { Media } from '@/composables/media';

// Props : données + configuration (readonly)
const props = defineProps<{
  items: Media[];
  selectedIds: Set<string>;
  draggingIds: string[];
  gridSize: GridSize;
}>();

// Emits : événements bruts (user intent)
const emit = defineEmits<{
  itemClick: [id: string, event: MouseEvent];
  itemDblclick: [item: Media];
  itemContextmenu: [event: MouseEvent, item: Media];
  checkboxClick: [id: string, event: MouseEvent];
  dragstart: [event: DragEvent, id: string];
  dragend: [];
}>();
</script>

<template>
  <!-- Template : affichage pur, délègue tout au parent -->
  <div :class="gridClasses">
    <MediaGridItem
      v-for="item in items"
      :key="item.id"
      :item="item"
      :selected="selectedIds.has(item.id)"
      :dragging="draggingIds.includes(item.id)"
      @click="emit('itemClick', item.id, $event)"
      @dblclick="emit('itemDblclick', item)"
    />
  </div>
</template>
```

---

## 6. Views - Orchestration

```vue
<script setup lang="ts">
// === IMPORTS ===
import { ref, watch, onMounted } from 'vue';
import { useFeature } from '@/composables/feature';
import Button from '@/components/atoms/Button.vue';
import Modal from '@/components/atoms/Modal.vue';
import Breadcrumb from '@/components/molecules/Breadcrumb.vue';
import SearchInput from '@/components/molecules/SearchInput.vue';
import FeatureSidebar from '@/components/organisms/FeatureSidebar.vue';
import FeatureGrid from '@/components/organisms/FeatureGrid.vue';

// === UI STATE (local à la vue) ===
const viewMode = ref<ViewMode>('grid');
const searchQuery = ref('');

// === COMPOSABLE (logique métier) ===
const {
  items,
  loading,
  selectedItems,
  load,
  create,
  handleItemClick,
} = useFeature(searchQuery);

// === MODALS STATE ===
const showDetail = ref<Item | null>(null);
const showCreateModal = ref(false);

// === LIFECYCLE ===
onMounted(() => refresh());

watch([currentFolder, searchQuery], () => {
  selectedItems.value.clear();
  load();
});

// === HANDLERS (orchestration) ===
async function refresh() {
  await load();
}

function handleNavigate(id: string | null) {
  navigateTo(id);
  searchQuery.value = '';
}
</script>
```

---

## 7. Imports

### Composants Vue - Imports directs (OBLIGATOIRE)

**Pas de barrel files pour les composants Vue.** Toujours utiliser les imports directs :

```typescript
// ❌ INTERDIT
import { Button, Modal } from '@/components/atoms';

// ✅ CORRECT
import Button from '@/components/atoms/Button.vue';
import Modal from '@/components/atoms/Modal.vue';
```

### Composables - Barrel exports OK

Les composables et types peuvent utiliser des barrel files :

```typescript
// composables/media/index.ts
export * from './types';
export { useMedia, getMediaUrl, isImage, formatSize, formatDate } from './useMedia';
```

Usage :

```typescript
import { type Media, useMedia, formatSize } from '@/composables/media';
```

---

## 8. Patterns Spécifiques

### Selection multi avec Set

```typescript
const selectedItems = ref<Set<string>>(new Set());

// Toggle
selectedItems.value.has(id)
  ? selectedItems.value.delete(id)
  : selectedItems.value.add(id);

// Select all
selectedItems.value = new Set(items.value.map(i => i.id));

// Clear
selectedItems.value.clear();
```

### Drag & Drop

```typescript
function handleDragStart(e: DragEvent, id: string) {
  // Collecter les IDs
  draggedIds.value = Array.from(selectedItems.value);

  // Data transfer
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData('text/plain', JSON.stringify({ type: 'media', ids: draggedIds.value }));

  // Custom drag image
  const dragImage = document.createElement('div');
  dragImage.className = 'bg-blue-600 text-white px-3 py-1 rounded text-sm';
  dragImage.textContent = `${draggedIds.value.length} fichier(s)`;
  dragImage.style.cssText = 'position:absolute;top:-1000px';
  document.body.appendChild(dragImage);
  e.dataTransfer!.setDragImage(dragImage, 0, 0);
  setTimeout(() => document.body.removeChild(dragImage), 0);
}
```

### Group hover (actions au survol)

```vue
<div class="group flex items-center">
  <span>{{ item.name }}</span>
  <div class="opacity-0 group-hover:opacity-100 transition">
    <IconButton @click="edit" />
    <IconButton @click="delete" variant="danger" />
  </div>
</div>
```

---

## 9. Conventions de Nommage

| Élément | Convention | Exemple |
|---------|------------|---------|
| Composables | `use[Feature]` | `useMedia`, `useProducts` |
| Types API | Inférence Eden | `type Media = Extract<...>` |
| Types UI | Interface/Union | `ViewMode`, `GridSize` |
| Props boolean | `is[State]` | `isActive`, `isDragging` |
| Emits | Verbe simple | `click`, `navigate`, `select` |
| Handlers | `handle[Action]` | `handleItemClick`, `handleDrop` |

---

## 10. Fichiers de Référence

### Composable complet

- `apps/echoppe-admin/src/composables/media/useMedia.ts`
- `apps/echoppe-admin/src/composables/media/types.ts`

### Vue complète

- `apps/echoppe-admin/src/views/MediaView.vue`

### Composants exemples

- **Atom** : `apps/echoppe-admin/src/components/atoms/Button.vue`
- **Molecule** : `apps/echoppe-admin/src/components/molecules/ContextMenu.vue`
- **Organism** : `apps/echoppe-admin/src/components/organisms/MediaGrid.vue`
