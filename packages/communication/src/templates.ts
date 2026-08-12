import type { EmailTemplate, EmailTemplateRenderer } from './types';

/**
 * Registre des gabarits e-mail.
 *
 * Le socle n'inscrit que les gabarits qu'il possède réellement — ceux qui n'ont rien à voir avec
 * la nature du produit. Les gabarits métier (commande, expédition, bienvenue boutique) sont
 * inscrits par le produit, à côté de la fonction d'envoi qui les utilise.
 *
 * TODO: rendu à remplacer par un système plus élaboré (MJML, React Email, etc.).
 */
const templates = new Map<EmailTemplate, EmailTemplateRenderer>();

export function registerEmailTemplate(name: EmailTemplate, render: EmailTemplateRenderer): void {
  templates.set(name, render);
}

export function hasEmailTemplate(name: EmailTemplate): boolean {
  return templates.has(name);
}

export function listEmailTemplates(): EmailTemplate[] {
  return [...templates.keys()];
}

/**
 * Rendu d'un gabarit e-mail. Lève si le gabarit n'a pas été inscrit — c'est ici, à l'exécution,
 * que se fait la vérification que le type ouvert ne peut plus faire.
 */
export function renderTemplate(template: EmailTemplate, data: Record<string, unknown>): string {
  const render = templates.get(template);
  if (!render) {
    throw new Error(`Unknown email template: ${template}`);
  }
  return render(data);
}

const BASE_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eee; }
  .content { padding: 20px 0; }
  .footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  .button { display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 4px; }
`;

export interface EmailLayoutParams {
  title: string;
  content: string;
  /** Pied de page — omis pour les e-mails internes (formulaire de contact). */
  footer?: string;
  /** Règles CSS propres au gabarit, ajoutées au socle commun. */
  extraStyles?: string;
}

/**
 * Enveloppe HTML commune à tous les gabarits — le bloc `<style>` était dupliqué dans chacun.
 */
export function emailLayout({ title, content, footer, extraStyles }: EmailLayoutParams): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>${BASE_STYLES}${extraStyles ?? ''}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${title}</h1>
        </div>
        <div class="content">${content}</div>
        ${footer ? `<div class="footer"><p>${footer}</p></div>` : ''}
      </div>
    </body>
    </html>
  `;
}

// ============================================
// GABARITS DU SOCLE
// ============================================

registerEmailTemplate('reset-password', (data) =>
  emailLayout({
    title: 'Réinitialisation de mot de passe',
    content: `
      <p>Bonjour,</p>
      <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
      <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
      <p><a href="${data.resetUrl}" class="button">Réinitialiser mon mot de passe</a></p>
      <p><small>Ce lien expire dans ${data.expiresIn ?? '1 heure'}.</small></p>
      <p><small>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</small></p>
    `,
    footer: `${data.siteName ?? 'Notre site'}`,
  }),
);

// Invitation d'un utilisateur d'administration (ADR-0048). Distincte de `reset-password`, qui
// s'adresse à quelqu'un ayant DEMANDÉ quelque chose : ici le destinataire n'a rien demandé, il faut
// donc lui dire qui l'invite et à quoi, sans quoi le message ressemble à un hameçonnage.
registerEmailTemplate('user-invitation', (data) =>
  emailLayout({
    title: `Bienvenue sur ${data.siteName ?? 'notre administration'}`,
    content: `
      <p>Bonjour ${data.firstName ?? ''},</p>
      <p>${data.invitedBy ? `${data.invitedBy} vous a` : 'Vous avez été'} invité${data.invitedBy ? '' : ''} à rejoindre l'administration de <strong>${data.siteName ?? 'notre site'}</strong>.</p>
      <p>Choisissez votre mot de passe pour activer votre accès :</p>
      <p><a href="${data.inviteUrl}" class="button">Définir mon mot de passe</a></p>
      <p><small>Ce lien expire dans ${data.expiresIn ?? '24 heures'} et ne fonctionne qu'une fois.</small></p>
      <p><small>Si vous ne vous attendiez pas à cette invitation, ignorez cet email : sans votre mot de passe, le compte reste inutilisable.</small></p>
    `,
    footer: `${data.siteName ?? 'Notre site'}`,
  }),
);

registerEmailTemplate('contact-form', (data) =>
  emailLayout({
    title: 'Nouveau message de contact',
    extraStyles: `
      .message { background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0; white-space: pre-wrap; }
    `,
    content: `
      <p><strong>De :</strong> ${data.name} (${data.email})</p>
      ${data.phone ? `<p><strong>Téléphone :</strong> ${data.phone}</p>` : ''}
      <p><strong>Sujet :</strong> ${data.subject ?? 'Contact'}</p>
      <div class="message">${data.message}</div>
    `,
  }),
);
