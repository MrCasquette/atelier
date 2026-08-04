// Vocabulaire de requête — vient de @repo/db, réexporté pour ne pas changer la surface.

// Abstraction d'injection des credentials (DIP) partagée par les familles d'adapters
export type { CredentialStore } from '@repo/adapters';
export type { Column, SQL } from '@repo/db';
// Connexion et runner de migrations : @repo/db (ADR-0025). Réexportés ici pour que la surface
// d'@echoppe/core ne bouge pas — les routes continuent d'écrire `import { product, db, eq }`.
export {
  and,
  asc,
  client,
  count,
  type Database,
  db,
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
  runMigrations,
  sql,
} from '@repo/db';
// Utils
export { decrypt, encrypt, generateEncryptionKey, isEncryptionConfigured } from '@repo/shared';
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
// Payment adapters
export * from './adapters/payment';
// Shipping adapters
export * from './adapters/shipping';
// RBAC constants
export * from './constants/resources';
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
