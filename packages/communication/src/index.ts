// @repo/communication — l'envoi d'e-mails, ses providers et ses gabarits.
//
// Ce paquet ne connaît AUCUN vocabulaire de produit. `EmailTemplate` est un registre ouvert
// (ADR-0007 de conventions.md, § « Un registre, pas une union fermée ») : il n'inscrit que les
// gabarits qu'il possède réellement — réinitialisation de mot de passe et formulaire de contact.
// Commande, expédition et bienvenue sont inscrits par Échoppe, dans son propre module.
//
// Sa seule dépendance à une table est `site`, pour le nom et l'URL du site dans les pieds de page.
// Elle sera remplacée par la surface de variables quand celle-ci existera (ADR-0035).
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
export {
  type ContactFormEmailData,
  type EmailResult,
  type ResetPasswordEmailData,
  type SendEmailParams,
  sendContactFormEmail,
  sendEmail,
  sendResetPasswordEmail,
  sendUserInvitationEmail,
  type UserInvitationEmailData,
} from './email';
export {
  getActiveCommunicationAdapter,
  getAvailableCommunicationProviders,
  getCommunicationAdapter,
  resetCommunicationAdapters,
} from './registry';
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
  CommunicationProvider,
  EmailMessage,
  EmailStatus,
  EmailTemplate,
  EmailTemplateRenderer,
  SendResult,
} from './types';
export { COMMUNICATION_PROVIDERS, isCommunicationProvider } from './types';
