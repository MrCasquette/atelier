# Dashboard Échoppe

Interface d'administration Vue 3.

## Structure

```
src/
├── components/
│   ├── atoms/           # 33 composants (Button, Modal, Input, icons/...)
│   ├── molecules/       # 15 composants (Breadcrumb, SearchInput, Pagination...)
│   └── organisms/       # 19 composants (MediaGrid, DataTable/, product/...)
├── composables/
│   ├── media/           # useMedia (dossiers, upload, sélection)
│   ├── product/         # useProductData, useProductForm, useProductVariants
│   ├── categories/      # useCategories (arbre, drag & drop)
│   ├── sortable/        # useSortable (tri drag & drop)
│   ├── useAuth.ts       # Authentification
│   ├── useToast.ts      # Notifications
│   ├── usePagination.ts # Pagination avec URL sync
│   └── useModalStack.ts # Z-index modales empilées
├── layouts/
│   └── AdminLayout.vue  # Layout principal avec sidebar
├── lib/
│   └── api.ts           # Eden client type-safe
├── views/               # 16 pages
├── router/
│   └── index.ts         # Routes avec auth guards
├── App.vue
└── main.ts
```

## Alias

Utiliser `@/` pour tous les imports :

```typescript
import { api } from '@/lib/api';
import Button from '@/components/atoms/Button.vue';
import Modal from '@/components/atoms/Modal.vue';
import { useMedia } from '@/composables/media';
```

## Atomic Design

### Atoms
Composants de base : `Button`, `IconButton`, `Modal`, `Input`, `Select`, `Checkbox`, `Combobox`, `Badge`, `RichTextEditor`, `Thumbnail`, + 23 icônes SVG dans `icons/`

### Molecules
Compositions d'atoms : `Breadcrumb`, `SearchInput`, `Pagination`, `ContextMenu`, `FolderTreeItem`, `CategoryTreeItem`, `FolderModal`, `MediaInfo`, `MediaPreview`, `ViewToggle`, `GridSizeToggle`, `FormField`, `SidebarNavItem`, `SidebarNavSection`, `SidebarUserMenu`

### Organisms
Sections UI complètes :
- **Media** : `FolderSidebar`, `MediaGrid`, `MediaList`, `MediaDetailModal`, `MediaBrowserModal`
- **Data** : `DataTable/` (avec `DataTableHeader`, `ColumnMenu`, `AddColumnPopover`)
- **Product** : `product/ProductHeader`, `ProductInfoCard`, `ProductSidebar`, `ProductVariantsCard`
- **Categories** : `CategoryTree`, `CategoryFormModal`
- **Layout** : `SidebarNav`, `ToastContainer`

## Views

| Page | Description |
|------|-------------|
| `DashboardView` | Accueil admin |
| `ProductsView` | Liste produits |
| `ProductEditView` | Édition produit |
| `CategoriesView` | Gestion catégories |
| `CollectionsView` | Gestion collections |
| `MediaView` | Médiathèque |
| `StockView` | Mouvements de stock |
| `OrdersView` | Liste commandes |
| `OrderDetailView` | Détail commande + factures |
| `PaymentsView` | Config Stripe/PayPal |
| `ShippingView` | Config transporteurs |
| `SettingsView` | Paramètres boutique |
| `ProfileView` | Profil utilisateur |
| `LoginView` | Authentification |

## Composables

Un composable par feature, dans un dossier dédié :

```
composables/
└── media/
    ├── types.ts      # Interfaces
    └── useMedia.ts   # State + actions
```

```typescript
// Utilisation
const { folders, mediaItems, loading, loadMedia, uploadFiles } = useMedia();
```

## API Client

Eden génère un client type-safe depuis l'API Elysia :

```typescript
import { api } from '@/lib/api';

// GET
const { data } = await api.products.get();

// GET avec params
const { data } = await api.products({ id: '123' }).get();

// POST
const { data } = await api.products.post({ name: 'Produit', slug: 'produit' });

// PUT
const { data } = await api.products({ id: '123' }).put({ name: 'Nouveau nom' });

// DELETE
await api.products({ id: '123' }).delete();
```

## Commandes

```bash
bun run dev:admin    # Lance le dashboard seul (port 3000)
bun run dev          # Lance API + Admin
```
