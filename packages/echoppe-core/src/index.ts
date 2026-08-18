// @echoppe/core — le cœur du produit Échoppe : il possède la base et ses migrations (ADR-0025).
//
// Ce barrel n'exporte QUE ce qui appartient au cœur. Une capacité partagée s'importe depuis SON
// paquet — `db` et le vocabulaire de requête depuis `@repo/db`, l'envoi depuis
// `@repo/communication`, le chiffrement depuis `@repo/shared`. C'est gardé, pas seulement écrit.

// Payment adapters
export * from './adapters/payment';
// Shipping adapters
export * from './adapters/shipping';
export * as faults from './constants/fault';
export type {
  CommerceResource,
  EchoppeErrorResponse,
  EchoppeFault,
  EchoppeRank,
  EchoppeResource,
  SharedResource,
} from './constants/fault-resources';
// RBAC constants
export * from './constants/resources';
export * from './db/schema/index';
// Invoice service
export * from './services/invoice';
// Réglages de la boutique (ADR-0034)
export {
  DEFAULT_STORE_SETTINGS,
  getStoreSettings,
  readStoreSettings,
  type StoreSettings,
  type StoreSettingsValues,
  saveStoreSettings,
} from './services/store-settings';
// Envois propres à la boutique — gabarits inscrits au chargement du module (cf. son en-tête).
export {
  type OrderEmailData,
  type ShipmentEmailData,
  sendOrderConfirmation,
  sendShipmentNotification,
  sendWelcomeEmail,
  type WelcomeEmailData,
} from './services/storefront-emails';
