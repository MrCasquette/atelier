// SSOT des providers de communication — ajouter un provider = l'inscrire ici (+ adapter +
// credentials). Registre, listings et schémas de route en dérivent, jamais de liste codée en dur.
export const COMMUNICATION_PROVIDERS = ['resend', 'brevo', 'smtp'] as const;
export type CommunicationProvider = (typeof COMMUNICATION_PROVIDERS)[number];

export function isCommunicationProvider(value: string): value is CommunicationProvider {
  return (COMMUNICATION_PROVIDERS as readonly string[]).includes(value);
}
export type EmailStatus = 'sent' | 'failed' | 'bounced';

// Le nom d'un gabarit appartient au PRODUIT, pas au socle : une boutique envoie
// 'order-confirmation', un CMS enverra 'comment-reply'. Le socle décrit le contrat et tient le
// registre ; le produit s'y inscrit (cf. conventions.md § Un registre, pas une union fermée).
//
// Contrairement à `Resource` (ADR-0038), l'espace n'est pas préfixé : un nom de gabarit n'est
// jamais passé en argument par du code appelant — on appelle `sendOrderConfirmation()`, jamais
// `sendEmail({ template: 'ordre-confirmation' })`. Il n'y a donc pas de faute de frappe à
// attraper au type ; le registre refuse à l'exécution un gabarit non inscrit.
export type EmailTemplate = string;

export type EmailTemplateRenderer = (data: Record<string, unknown>) => string;

export interface EmailMessage {
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
  replyTo?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface CommunicationConfig {
  fromEmail: string;
  fromName: string;
  replyTo?: string;
}

// Source injectée (DIP) : un adapter de communication a besoin de ses credentials (clé API / SMTP)
// ET de la config d'envoi (expéditeur, reply-to). Le registre l'adosse à la base (déchiffrement) ;
// un test la stub → adapter testable sans base de données.
export interface CommunicationCredentialStore<T> {
  getCredentials(): Promise<T | null>;
  getConfig(): Promise<CommunicationConfig | null>;
}

export interface CommunicationAdapter {
  readonly provider: CommunicationProvider;

  /**
   * Envoie un email
   */
  send(message: EmailMessage): Promise<SendResult>;

  /**
   * Vérifie que la connexion fonctionne (test)
   */
  verify(): Promise<boolean>;

  /**
   * Vérifie si l'adapter est configuré (credentials présents et activé)
   */
  isConfigured(): Promise<boolean>;
}
