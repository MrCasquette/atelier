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

export type Action = 'create' | 'read' | 'update' | 'delete';

/**
 * Liste des ressources pour itération
 */
export const RESOURCE_LIST = Object.values(RESOURCES);
