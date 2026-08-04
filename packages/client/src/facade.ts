// Généré par scripts/generate.ts — NE PAS ÉDITER À LA MAIN.
// Façade ressource : namespaces à plat au-dessus du contrat storefront. Chaque méthode
// délègue au client brut openapi-fetch (accessible séparément via `echoppe.raw`).

import type { Client, MaybeOptionalInit } from 'openapi-fetch';
import type { paths } from './openapi.js';

export function createResources(client: Client<paths>) {
  return {
    account: {
      update: (init: MaybeOptionalInit<paths['/customer/profile'], 'patch'>) => client.PATCH('/customer/profile', init),
    },
    addresses: {
      create: (init: MaybeOptionalInit<paths['/customer/addresses/'], 'post'>) => client.POST('/customer/addresses/', init),
      get: (init: MaybeOptionalInit<paths['/customer/addresses/{id}'], 'get'>) => client.GET('/customer/addresses/{id}', init),
      list: (init?: MaybeOptionalInit<paths['/customer/addresses/'], 'get'>) => client.GET('/customer/addresses/', init),
      remove: (init: MaybeOptionalInit<paths['/customer/addresses/{id}'], 'delete'>) => client.DELETE('/customer/addresses/{id}', init),
      update: (init: MaybeOptionalInit<paths['/customer/addresses/{id}'], 'put'>) => client.PUT('/customer/addresses/{id}', init),
    },
    auth: {
      changePassword: (init: MaybeOptionalInit<paths['/customer/auth/password'], 'post'>) => client.POST('/customer/auth/password', init),
      forgotPassword: (init: MaybeOptionalInit<paths['/customer/auth/password/forgot'], 'post'>) => client.POST('/customer/auth/password/forgot', init),
      login: (init: MaybeOptionalInit<paths['/customer/auth/login'], 'post'>) => client.POST('/customer/auth/login', init),
      logout: (init?: MaybeOptionalInit<paths['/customer/auth/logout'], 'post'>) => client.POST('/customer/auth/logout', init),
      me: (init?: MaybeOptionalInit<paths['/customer/auth/me'], 'get'>) => client.GET('/customer/auth/me', init),
      refresh: (init?: MaybeOptionalInit<paths['/customer/auth/refresh'], 'post'>) => client.POST('/customer/auth/refresh', init),
      register: (init: MaybeOptionalInit<paths['/customer/auth/register'], 'post'>) => client.POST('/customer/auth/register', init),
      resetPassword: (init: MaybeOptionalInit<paths['/customer/auth/password/reset'], 'post'>) => client.POST('/customer/auth/password/reset', init),
    },
    cart: {
      addItem: (init: MaybeOptionalInit<paths['/cart/items'], 'post'>) => client.POST('/cart/items', init),
      clear: (init?: MaybeOptionalInit<paths['/cart/'], 'delete'>) => client.DELETE('/cart/', init),
      get: (init?: MaybeOptionalInit<paths['/cart/'], 'get'>) => client.GET('/cart/', init),
      merge: (init?: MaybeOptionalInit<paths['/cart/merge'], 'post'>) => client.POST('/cart/merge', init),
      removeItem: (init: MaybeOptionalInit<paths['/cart/items/{id}'], 'delete'>) => client.DELETE('/cart/items/{id}', init),
      updateItem: (init: MaybeOptionalInit<paths['/cart/items/{id}'], 'patch'>) => client.PATCH('/cart/items/{id}', init),
    },
    categories: {
      bySlug: (init: MaybeOptionalInit<paths['/categories/by-slug/{slug}'], 'get'>) => client.GET('/categories/by-slug/{slug}', init),
      get: (init: MaybeOptionalInit<paths['/categories/{id}'], 'get'>) => client.GET('/categories/{id}', init),
      list: (init?: MaybeOptionalInit<paths['/categories/'], 'get'>) => client.GET('/categories/', init),
      products: (init: MaybeOptionalInit<paths['/categories/{id}/products'], 'get'>) => client.GET('/categories/{id}/products', init),
    },
    checkout: {
      create: (init: MaybeOptionalInit<paths['/checkout/'], 'post'>) => client.POST('/checkout/', init),
      pay: (init: MaybeOptionalInit<paths['/payments/checkout'], 'post'>) => client.POST('/payments/checkout', init),
      paymentProviders: (init?: MaybeOptionalInit<paths['/checkout/payment-providers'], 'get'>) => client.GET('/checkout/payment-providers', init),
    },
    collections: {
      bySlug: (init: MaybeOptionalInit<paths['/collections/by-slug/{slug}'], 'get'>) => client.GET('/collections/by-slug/{slug}', init),
      get: (init: MaybeOptionalInit<paths['/collections/{id}'], 'get'>) => client.GET('/collections/{id}', init),
      list: (init?: MaybeOptionalInit<paths['/collections/'], 'get'>) => client.GET('/collections/', init),
      products: (init: MaybeOptionalInit<paths['/collections/{id}/products'], 'get'>) => client.GET('/collections/{id}/products', init),
    },
    contact: {
      send: (init: MaybeOptionalInit<paths['/contact/'], 'post'>) => client.POST('/contact/', init),
    },
    countries: {
      list: (init?: MaybeOptionalInit<paths['/countries/'], 'get'>) => client.GET('/countries/', init),
    },
    identity: {
      get: (init?: MaybeOptionalInit<paths['/identity/'], 'get'>) => client.GET('/identity/', init),
    },
    menus: {
      byHandle: (init: MaybeOptionalInit<paths['/menus/by-handle/{handle}'], 'get'>) => client.GET('/menus/by-handle/{handle}', init),
    },
    orders: {
      get: (init: MaybeOptionalInit<paths['/customer/orders/{id}'], 'get'>) => client.GET('/customer/orders/{id}', init),
      list: (init?: MaybeOptionalInit<paths['/customer/orders/'], 'get'>) => client.GET('/customer/orders/', init),
    },
    pages: {
      bySlug: (init: MaybeOptionalInit<paths['/pages/by-slug/{slug}'], 'get'>) => client.GET('/pages/by-slug/{slug}', init),
      list: (init?: MaybeOptionalInit<paths['/pages/'], 'get'>) => client.GET('/pages/', init),
    },
    products: {
      bySlug: (init: MaybeOptionalInit<paths['/products/by-slug/{slug}'], 'get'>) => client.GET('/products/by-slug/{slug}', init),
      get: (init: MaybeOptionalInit<paths['/products/{id}'], 'get'>) => client.GET('/products/{id}', init),
      list: (init?: MaybeOptionalInit<paths['/products/'], 'get'>) => client.GET('/products/', init),
      media: (init: MaybeOptionalInit<paths['/products/{id}/media'], 'get'>) => client.GET('/products/{id}/media', init),
      related: (init: MaybeOptionalInit<paths['/products/{id}/related'], 'get'>) => client.GET('/products/{id}/related', init),
      variants: (init: MaybeOptionalInit<paths['/products/{id}/variants'], 'get'>) => client.GET('/products/{id}/variants', init),
    },
    taxRates: {
      list: (init?: MaybeOptionalInit<paths['/tax-rates/'], 'get'>) => client.GET('/tax-rates/', init),
    },
    wishlist: {
      add: (init: MaybeOptionalInit<paths['/wishlist/'], 'post'>) => client.POST('/wishlist/', init),
      list: (init?: MaybeOptionalInit<paths['/wishlist/'], 'get'>) => client.GET('/wishlist/', init),
      remove: (init: MaybeOptionalInit<paths['/wishlist/{variantId}'], 'delete'>) => client.DELETE('/wishlist/{variantId}', init),
    },
  };
}
