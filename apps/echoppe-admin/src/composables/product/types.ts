import { api } from '@/lib/api';
import type { ApiData, ApiItem, ApiPaginatedItem } from '@/types/api';

// Types inférés depuis Eden
// ProductListItem = type avec featuredImage/defaultVariant (pour affichage liste)
export type ProductListItem = ApiPaginatedItem<ReturnType<typeof api.products.get>>;
// Product = type de base (pour édition). On omet les champs d'affichage propres à la carte liste
// (featuredImage/defaultVariant/images/swatches/tags) : l'édition charge ses médias via
// loadProductMedia() et ses tags via `/full`.
export type Product = Omit<
  ProductListItem,
  'featuredImage' | 'defaultVariant' | 'images' | 'swatches' | 'tags'
>;
export type TaxRate = ApiItem<ReturnType<typeof api['tax-rates']['get']>>;
export type Collection = ApiPaginatedItem<ReturnType<typeof api.collections.get>>;

// Produit détaillé pour l'édition admin : lecture ADMIN complète (GET /products/:id/full) qui
// expose les champs internes du variant (costPrice/lowStockThreshold) — le public `/products/:id`
// les masque. `Variant` = variant d'AFFICHAGE admin (complet + optionValues).
type ProductDetailResponse = Awaited<ReturnType<ReturnType<typeof api.products>['full']['get']>>;
export type ProductDetail = Extract<NonNullable<ProductDetailResponse['data']>, { variants: unknown[] }>;
export type Variant = ProductDetail['variants'][number];

// `VariantMutation` = réponse du CRUD variant (POST/PUT /products/:id/variants) : variant complet
// SANS `optionValues` (les valeurs d'option ne changent pas via ces routes). Distinct de `Variant`
// (qui porte optionValues) → on ne caste pas l'un vers l'autre.
export type VariantMutation = ApiData<
  ReturnType<ReturnType<typeof api.products>['variants']['post']>
>;

// Option (axe) enrichie de ses valeurs — INFÉRÉE d'Eden (via ProductDetail), plus de shape manuel.
// Porte `type` (string|color) et, sur chaque valeur, `metadata` (couleur oklch).
export type Option = ProductDetail['options'][number];
export type OptionValueItem = Option['values'][number];
export type ColorMetadata = NonNullable<OptionValueItem['metadata']>;
// Option globale telle que listée par GET /products/options (id, name, type), sans les valeurs.
export type GlobalOption = ApiItem<ReturnType<typeof api.products['option-axes']['get']>>;

// Type ProductMedia inféré depuis Eden
export type ProductMedia = NonNullable<
  Awaited<ReturnType<ReturnType<typeof api.products>['media']['get']>>['data']
>[number];

// Champ de personnalisation (ADR-0010) — inféré depuis Eden (fiche admin `/full`).
export type PersonalizationField = ProductDetail['personalizationFields'][number];

// Form state
export interface ProductFormState {
  name: string;
  slug: string;
  description: string;
  category: string;
  taxRate: string;
  collection: string;
  status: 'draft' | 'published' | 'archived';
  personalizationEnabled: boolean;
  tags: string[];
  relatedProductIds: string[];
}

// Select option type
export interface SelectOption {
  value: string;
  label: string;
}
