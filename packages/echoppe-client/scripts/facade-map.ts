// SSOT de la FORME de la façade `@axiome-apps/echoppe-client` : pour chaque opération du contrat
// storefront, son namespace (à plat) et son nom de méthode. Le générateur (`generate.ts`)
// émet `src/facade.ts` à partir de cette table + du contrat figé.
//
// Garde anti-dérive : toute opération du contrat non couverte ici (hors `FACADE_SKIP_TAGS`)
// déclenche un avertissement à la génération → on nomme sciemment chaque méthode du SDK,
// jamais d'auto-nommage hasardeux.
//
// Structure ACTÉE : namespaces À PLAT (pas de `catalog.*`/`customer.*`), + client brut
// exposé en échappatoire via `echoppe.raw`.

/** Tags dont les routes ne passent PAS par la façade (servies par un helper dédié). */
export const FACADE_SKIP_TAGS: ReadonlyArray<string> = [
  'Assets', // `/assets/{id}` = URL d'image → helper `mediaUrl(id)`, pas un appel fetch.
];

/** Tag OpenAPI → namespace de la façade. Plusieurs tags peuvent pointer le même namespace. */
export const TAG_NAMESPACE: Record<string, string> = {
  Products: 'products',
  Categories: 'categories',
  Collections: 'collections',
  Cart: 'cart',
  Wishlist: 'wishlist',
  Checkout: 'checkout',
  Payments: 'checkout', // `/payments/checkout` fusionné dans checkout (`checkout.pay()`).
  Identity: 'identity',
  'Tax Rates': 'taxRates',
  Countries: 'countries',
  Contact: 'contact',
  Pages: 'pages',
  Entities: 'entities',
  Menus: 'menus',
  'Customer Auth': 'auth',
  'Customer Account': 'account',
  'Customer Addresses': 'addresses',
  'Customer Orders': 'orders',
};

/** operationId (contrat) → nom de méthode dans son namespace. */
export const METHOD_NAMES: Record<string, string> = {
  // products
  getProducts: 'list',
  'getProductsBy-slugBySlug': 'bySlug',
  getProductsById: 'get',
  getProductsByIdRelated: 'related',
  getProductsByIdMedia: 'media',
  getProductsByIdVariants: 'variants',
  // categories
  getCategories: 'list',
  'getCategoriesBy-slugBySlug': 'bySlug',
  getCategoriesById: 'get',
  getCategoriesByIdProducts: 'products',
  // collections
  getCollections: 'list',
  'getCollectionsBy-slugBySlug': 'bySlug',
  getCollectionsById: 'get',
  getCollectionsByIdProducts: 'products',
  // cart
  getCart: 'get',
  deleteCart: 'clear',
  postCartItems: 'addItem',
  patchCartItemsById: 'updateItem',
  deleteCartItemsById: 'removeItem',
  postCartMerge: 'merge',

  getWishlist: 'list',
  postWishlist: 'add',
  deleteWishlistByVariantId: 'remove',
  // checkout (+ payments)
  postCheckout: 'create',
  'getCheckoutPayment-providers': 'paymentProviders',
  postPaymentsCheckout: 'pay',
  // pages (content)
  getPages: 'list',
  'getPagesBy-slugBySlug': 'bySlug',
  // entités déclarées (ADR-0027)
  getEntitiesByName: 'list',
  getEntitiesByNameBySlug: 'bySlug',
  // menus (navigation)
  'getMenusBy-handleByHandle': 'byHandle',
  // identity / taxRates / contact
  getIdentity: 'get',
  'getTax-rates': 'list',
  getCountries: 'list',
  postContact: 'send',
  // addresses
  getCustomerAddresses: 'list',
  postCustomerAddresses: 'create',
  getCustomerAddressesById: 'get',
  putCustomerAddressesById: 'update',
  deleteCustomerAddressesById: 'remove',
  // orders
  getCustomerOrders: 'list',
  getCustomerOrdersById: 'get',
  // account
  patchCustomerProfile: 'update',
  // auth
  postCustomerAuthRegister: 'register',
  postCustomerAuthLogin: 'login',
  postCustomerAuthLogout: 'logout',
  postCustomerAuthRefresh: 'refresh',
  getCustomerAuthMe: 'me',
  postCustomerAuthPassword: 'changePassword',
  postCustomerAuthPasswordForgot: 'forgotPassword',
  postCustomerAuthPasswordReset: 'resetPassword',
};
