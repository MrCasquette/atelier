/**
 * Helpers pour extraire les types depuis les réponses Eden/Treaty
 *
 * Eden retourne { data: T | null, error: E | null }
 * Ces helpers simplifient l'extraction des types utiles.
 *
 * Usage:
 *   // Liste simple
 *   type Category = ApiItem<ReturnType<typeof api.categories.get>>;
 *
 *   // Réponse paginée
 *   type Product = ApiPaginatedItem<ReturnType<typeof api.products.get>>;
 *
 *   // Objet simple
 *   type Settings = ApiData<ReturnType<typeof api.settings.get>>;
 */

// Type de base pour les réponses Eden
type EdenResponse<T = unknown> = Promise<{ data: T | null; error: unknown }>;

// Extrait le type `data` d'une réponse API (exclut null)
export type ApiData<T extends EdenResponse> = NonNullable<Awaited<T>['data']>;

// Extrait un item d'une liste API (ex: GET /categories → Category[])
export type ApiItem<T extends EdenResponse<unknown[]>> = ApiData<T>[number];

// Extrait un item d'une réponse paginée (ex: GET /products → { data: Product[], meta })
export type ApiPaginatedItem<T extends EdenResponse<{ data: unknown[] }>> = ApiData<T>['data'][number];

// Extrait la meta d'une réponse paginée
export type ApiPaginatedMeta<T extends EdenResponse<{ meta: unknown }>> = ApiData<T>['meta'];
