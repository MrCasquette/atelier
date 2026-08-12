import { db } from '@repo/db';
import { site } from '@repo/identity';
import { getActiveCommunicationAdapter } from './registry';
import { communicationLog } from './schema';
import type { EmailTemplate, SendResult } from './types';

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
 * Identité du site, pour les pieds de page des e-mails (ADR-0040).
 *
 * Le repli existe parce que `site` peut ne pas encore être renseigné — rien n'est fabriqué à
 * l'installation (ADR-0039).
 */
async function getSiteInfo(): Promise<{ name: string; url?: string }> {
  const [siteData] = await db.select().from(site).limit(1);
  return {
    name: siteData?.name ?? 'Notre site',
    url: siteData?.url ?? undefined,
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

  // Enrichir les data avec les infos du site
  const siteInfo = await getSiteInfo();
  const enrichedData = {
    siteName: siteInfo.name,
    siteUrl: siteInfo.url,
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

export interface UserInvitationEmailData {
  email: string;
  firstName: string;
  inviteUrl: string;
  /** Qui invite — le message doit le dire, sinon il ressemble à un hameçonnage. */
  invitedBy?: string;
  expiresIn?: string;
}

/**
 * Invitation d'un utilisateur d'administration à poser son mot de passe (ADR-0048).
 *
 * `skipped: true` quand aucun fournisseur n'est configuré : l'appelant rend alors le lien à celui
 * qui invite, plutôt que de laisser l'invitation dans le vide.
 */
export async function sendUserInvitationEmail(data: UserInvitationEmailData): Promise<EmailResult> {
  return sendEmail({
    to: data.email,
    subject: 'Votre accès à l’administration',
    template: 'user-invitation',
    data: {
      firstName: data.firstName,
      inviteUrl: data.inviteUrl,
      invitedBy: data.invitedBy,
      expiresIn: data.expiresIn ?? '24 heures',
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
