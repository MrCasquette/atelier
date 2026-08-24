// SSOT (machine) de la surface consommée par CE client : la liste des routes storefront
// que `@axiome-apps/echoppe-client` expose. Le générateur (generate.ts) filtre le contrat complet de
// l'API sur cette liste, puis tree-shake les schémas → le SDK ne voit QUE la boutique.
//
// La doc humaine de référence est `apps/echoppe-api/docs/route-audience.md` (côté API). Cette liste
// en est la traduction exécutable. `generate.ts` avertit si une entrée ne correspond à
// aucune route du contrat (garde anti-dérive).
//
// Méthodes en minuscules (clés OpenAPI). Paths = tels qu'émis par le contrat (trailing
// slash inclus pour les racines de groupe).

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export const STOREFRONT_SURFACE: ReadonlyArray<readonly [HttpMethod, string]> = [
  // --- Public : médias ---
  ['get', '/assets/{id}'],

  // --- Public : catalogue ---
  ['get', '/products/'],
  ['get', '/products/by-slug/{slug}'],
  ['get', '/products/{id}'],
  ['get', '/products/{id}/variants'],
  ['get', '/products/{id}/related'],
  ['get', '/products/{id}/media'],
  ['get', '/categories/'],
  ['get', '/categories/{id}'],
  ['get', '/categories/by-slug/{slug}'],
  ['get', '/categories/{id}/products'],
  ['get', '/collections/'],
  ['get', '/collections/{id}'],
  ['get', '/collections/by-slug/{slug}'],
  ['get', '/collections/{id}/products'],

  // --- Public : pages (content / page builder) ---
  ['get', '/pages/'],
  ['get', '/pages/by-slug/{slug}'],

  // --- Public : entités déclarées (ADR-0027) ---
  // Deux routes GÉNÉRIQUES, et c'est ce qui permet à cette liste d'exister : des routes dérivées du
  // registre rendraient le contrat dépendant de l'installation, et ce SDK ingénérable.
  ['get', '/entities/{name}'],
  ['get', '/entities/{name}/{slug}'],

  // --- Public : menus de navigation ---
  ['get', '/menus/by-handle/{handle}'],

  // --- Public : panier (session cookie) ---
  ['get', '/cart/'],
  ['post', '/cart/items'],
  ['patch', '/cart/items/{id}'],
  ['delete', '/cart/items/{id}'],
  ['delete', '/cart/'],
  ['post', '/cart/merge'],

  // --- Public : divers boutique ---
  ['get', '/checkout/payment-providers'],
  ['get', '/identity/'],
  ['get', '/tax-rates/'],
  ['get', '/countries/'],
  ['post', '/contact/'],

  // --- Client authentifié (customerAuth) ---
  ['post', '/customer/auth/register'],
  ['post', '/customer/auth/login'],
  ['post', '/customer/auth/logout'],
  ['post', '/customer/auth/refresh'],
  ['get', '/customer/auth/me'],
  ['post', '/customer/auth/password'],
  ['post', '/customer/auth/password/forgot'],
  ['post', '/customer/auth/password/reset'],
  ['patch', '/customer/profile'],
  ['get', '/customer/addresses/'],
  ['get', '/customer/addresses/{id}'],
  ['post', '/customer/addresses/'],
  ['put', '/customer/addresses/{id}'],
  ['delete', '/customer/addresses/{id}'],
  ['get', '/customer/orders/'],
  ['get', '/customer/orders/{id}'],
  ['get', '/wishlist/'],
  ['post', '/wishlist/'],
  ['delete', '/wishlist/{variantId}'],
  ['post', '/checkout/'],
  ['post', '/payments/checkout'],
];
