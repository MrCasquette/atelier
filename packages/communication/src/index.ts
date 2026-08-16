// @repo/communication — l'envoi d'e-mails, ses providers et ses gabarits.
//
// Aucun vocabulaire de produit : n'inscrire ici que les gabarits que le socle possède réellement.
// L'envoi n'a pas de couture pour les tests — voir README.md avant d'y toucher.

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
