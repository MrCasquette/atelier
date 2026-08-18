/**
 * Ressources protégées par le système RBAC
 * Chaque ressource peut avoir des permissions CRUD distinctes
 */
export const RESOURCES = {
  // Catalogue
  PRODUCT: 'product',
  CATEGORY: 'category',
  COLLECTION: 'collection',
  VARIANT: 'variant',
  OPTION: 'option',
  TAX_RATE: 'tax_rate',

  // Référentiel
  COUNTRY: 'country',

  // Médias (folder operations are protected by media permission)
  MEDIA: 'media',

  // Contenu (page builder)
  CONTENT: 'content',

  // Structure : pousser un registre de définitions, dériver la table d'une entité. Éditer du
  // contenu et redéfinir ce qu'EST un contenu sont deux actes distincts — le second peut invalider
  // des données existantes. Cette ressource tient au RANG (ADR-0038) : le seed l'accorde au premier
  // rang, et `undelegatableGrants` refuse de la transmettre.
  SCHEMA: 'schema',

  // Commerce
  ORDER: 'order',
  CART: 'cart',
  WISHLIST: 'wishlist',
  INVOICE: 'invoice',

  // Clients
  CUSTOMER: 'customer',
  ADDRESS: 'address',

  // Administration
  USER: 'user',
  ROLE: 'role',
  PERMISSION: 'permission',
  IDENTITY: 'identity',
  STOCK: 'stock',
  SHIPPING_PROVIDER: 'shipping_provider',
  PAYMENT_CONFIG: 'payment_config',
  COMMUNICATION_CONFIG: 'communication_config',
  AUDIT_LOG: 'audit_log',

  // Clés d'API machine (CLI, CI)
  API_KEY: 'api_key',
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];

/**
 * Ce qu'une garde sait protéger : le vocabulaire du framework, **plus** les entités déclarées
 * (ADR-0038).
 *
 * `RESOURCES` reste fermé — une faute de frappe sur `product` se voit toujours à la compilation.
 * Mais une entité est inconnue du framework par nature : c'est le dev qui la déclare, après la
 * compilation. L'espace `entity:` est ce qui permet de la nommer sans rouvrir tout le reste.
 *
 * La ressource d'une entité est **dérivée** du registre, jamais matérialisée : la SSOT, ce sont les
 * fichiers du dev, et l'écrire quelque part créerait une seconde source à garder d'accord.
 */
export type ProtectedResource = Resource | `entity:${string}`;

/**
 * Liste des ressources pour itération
 */
export const RESOURCE_LIST = Object.values(RESOURCES);
