import { site } from '@repo/identity';
import type { CommunicationService } from '@repo/communication';
import { db } from '@repo/db';

// Logique du formulaire de contact, sans rien savoir du transport. Les quatre issues sont des
// valeurs de retour, pas des exceptions ni des codes HTTP : c'est le controller qui les traduit
// (ADR-0044 — un service partagé ne connaît pas `status()`).

export type ContactMessage = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export type ContactOutcome =
  /** Message remis au fournisseur d'e-mail. */
  | { outcome: 'sent' }
  /** Le site n'a pas d'adresse publique : personne à qui écrire. */
  | { outcome: 'no-recipient' }
  /** Aucun fournisseur d'e-mail configuré — l'envoi a été sauté, pas tenté. */
  | { outcome: 'not-configured' }
  /** Le fournisseur a été appelé et a échoué. */
  | { outcome: 'send-failed' };

export async function sendContactMessage(
  mail: CommunicationService,
  input: ContactMessage,
): Promise<ContactOutcome> {
  const [siteData] = await db.select().from(site).limit(1);

  if (!siteData?.publicEmail) return { outcome: 'no-recipient' };

  const result = await mail.sendContactForm({
    adminEmail: siteData.publicEmail,
    senderName: input.name,
    senderEmail: input.email,
    subject: input.subject,
    message: input.message,
  });

  if (!result.success) return { outcome: 'send-failed' };
  if (result.skipped) return { outcome: 'not-configured' };

  return { outcome: 'sent' };
}
