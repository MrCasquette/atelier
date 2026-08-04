import { db } from '@repo/db';
import {
  type EmailTemplate,
  getActiveCommunicationAdapter,
  type SendResult,
} from '../adapters/communication';
import { company } from '../db/schema/admin';
import { communicationLog } from '../db/schema/communication';

export interface SendEmailParams {
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
  replyTo?: string;
}

export interface EmailResult extends SendResult {
  skipped?: boolean;
}

/**
 * Récupère les infos de la boutique pour les emails
 */
async function getShopInfo(): Promise<{ name: string; url?: string }> {
  const [companyData] = await db.select().from(company).limit(1);
  return {
    name: companyData?.shopName ?? 'Notre boutique',
    url: undefined, // TODO: ajouter l'URL du store dans company
  };
}

/**
 * Envoie un email via le provider configuré
 * - Si aucun provider configuré, retourne success: true avec skipped: true
 * - Log automatiquement le résultat en DB
 */
export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  const adapter = await getActiveCommunicationAdapter();

  // Aucun provider configuré - skip silently
  if (!adapter) {
    return { success: true, skipped: true };
  }

  // Enrichir les data avec les infos boutique
  const shopInfo = await getShopInfo();
  const enrichedData = {
    shopName: shopInfo.name,
    shopUrl: shopInfo.url,
    ...params.data,
  };

  // Envoyer l'email
  const result = await adapter.send({
    to: params.to,
    subject: params.subject,
    template: params.template,
    data: enrichedData,
    replyTo: params.replyTo,
  });

  // Log en DB
  await db.insert(communicationLog).values({
    provider: adapter.provider,
    channel: 'email',
    template: params.template,
    recipient: params.to,
    subject: params.subject,
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    error: result.error,
    metadata: enrichedData,
  });

  return result;
}

// ============================================
// HELPERS TYPÉS PAR ACTION — GABARITS DU SOCLE
// ============================================
//
// Les envois propres au commerce (commande, expédition, bienvenue boutique) vivent dans
// `storefront-emails.ts`, avec les gabarits qu'ils inscrivent.

export interface ResetPasswordEmailData {
  email: string;
  resetUrl: string;
  expiresIn?: string;
}

/**
 * Email de réinitialisation de mot de passe
 */
export async function sendResetPasswordEmail(data: ResetPasswordEmailData): Promise<EmailResult> {
  return sendEmail({
    to: data.email,
    subject: 'Réinitialisation de votre mot de passe',
    template: 'reset-password',
    data: {
      resetUrl: data.resetUrl,
      expiresIn: data.expiresIn ?? '1 heure',
    },
  });
}

export interface ContactFormEmailData {
  adminEmail: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  subject?: string;
  message: string;
}

/**
 * Email de formulaire de contact (envoyé à l'admin)
 */
export async function sendContactFormEmail(data: ContactFormEmailData): Promise<EmailResult> {
  return sendEmail({
    to: data.adminEmail,
    subject: `Contact: ${data.subject ?? 'Nouveau message'}`,
    template: 'contact-form',
    data: {
      name: data.senderName,
      email: data.senderEmail,
      phone: data.senderPhone,
      subject: data.subject,
      message: data.message,
    },
    replyTo: data.senderEmail,
  });
}
