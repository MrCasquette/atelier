// @repo/communication — l'envoi d'e-mails, ses providers et ses gabarits.
//
// Aucun vocabulaire de produit : n'inscrire ici que les gabarits que le socle possède réellement.
//
// L'envoi est un ACTEUR — `CommunicationService`, composé par le produit à son démarrage. Il n'y a
// pas d'instance de module : c'est ce qui rend le chemin d'envoi testable, en substituant un
// registre et un journal. Voir README.md.

/** Ce que ce paquet possède, nommable dans une faute (ADR-0050). Un produit compose les siennes. */
export type CommunicationResource = 'email_template' | 'communication_provider';
export { BrevoAdapter } from './brevo';
export {
  type BrevoCredentials,
  getAllProvidersStatus,
  getProviderConfig,
  getProviderCredentials,
  getProviderStatus,
  type ResendCredentials,
  type SmtpCredentials,
  saveProviderCredentials,
  setProviderEnabled,
} from './config';
export { createDbJournal, createDbProviderReadiness } from './journal';
export {
  type CommunicationFactories,
  type CommunicationRegistry,
  createCommunicationRegistry,
  defaultCommunicationFactories,
} from './registry';
export {
  CommunicationService,
  type CommunicationDeps,
  type ContactFormEmailData,
  type EmailResult,
  type ResetPasswordEmailData,
  type SendEmailParams,
  type UserInvitationEmailData,
} from './service';
export { ResendAdapter } from './resend';
export { communicationLog, communicationProviderConfig, communicationProviderEnum } from './schema';
export { SmtpAdapter } from './smtp';
export {
  type EmailLayoutParams,
  emailLayout,
  hasEmailTemplate,
  listEmailTemplates,
  registerEmailTemplate,
  renderTemplate,
} from './templates';
export type {
  CommunicationAdapter,
  CommunicationConfig,
  CommunicationCredentialStore,
  CommunicationJournal,
  CommunicationLogEntry,
  CommunicationProvider,
  EmailMessage,
  EmailStatus,
  EmailTemplate,
  EmailTemplateRenderer,
  SendResult,
  SiteIdentity,
} from './types';
export { COMMUNICATION_PROVIDERS, isCommunicationProvider } from './types';
