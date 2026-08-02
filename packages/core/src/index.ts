export type { Column, SQL } from 'drizzle-orm';
// Re-export drizzle-orm utilities
export {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
// Communication adapters
export {
  BrevoAdapter,
  type BrevoCredentials,
  COMMUNICATION_PROVIDERS,
  // Types
  type CommunicationAdapter,
  type CommunicationConfig,
  type CommunicationProvider,
  type EmailMessage,
  type EmailStatus,
  type EmailTemplate,
  getActiveCommunicationAdapter,
  getAllProvidersStatus as getAllCommunicationProvidersStatus,
  getAvailableCommunicationProviders,
  // Factory
  getCommunicationAdapter,
  getProviderConfig as getCommunicationProviderConfig,
  // Config (renamed to avoid conflicts)
  getProviderCredentials as getCommunicationProviderCredentials,
  getProviderStatus as getCommunicationProviderStatus,
  isCommunicationProvider,
  // Adapters
  ResendAdapter,
  type ResendCredentials,
  // Templates
  renderTemplate,
  resetCommunicationAdapters,
  type SendResult,
  SmtpAdapter,
  type SmtpCredentials,
  saveProviderCredentials as saveCommunicationProviderCredentials,
  setProviderEnabled as setCommunicationProviderEnabled,
} from './adapters/communication';
// Abstraction d'injection des credentials (DIP) partagée par les familles d'adapters
export type { CredentialStore } from './adapters/credential-store';
// Payment adapters
export * from './adapters/payment';
// Shipping adapters
export * from './adapters/shipping';
// RBAC constants
export * from './constants/resources';
export type { Database } from './db/index';
export { db } from './db/index';
export { runMigrations } from './db/migrate';
export * from './db/schema/index';
// Email service
export {
  type ContactFormEmailData,
  type EmailResult,
  type ResetPasswordEmailData,
  type SendEmailParams,
  sendContactFormEmail,
  sendEmail,
  sendResetPasswordEmail,
} from './services/email';
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
// Utils
export { decrypt, encrypt, generateEncryptionKey, isEncryptionConfigured } from './utils/crypto';
