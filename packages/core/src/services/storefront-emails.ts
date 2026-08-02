import { emailLayout, registerEmailTemplate } from '../adapters/communication/templates';
import { type EmailResult, sendEmail } from './email';

/**
 * Envois e-mail propres à la boutique — commande, expédition, bienvenue client.
 *
 * Ce module appartient à Échoppe, pas au socle : les gabarits sont inscrits ici, à côté des
 * fonctions qui les utilisent. Aucun câblage de démarrage n'est nécessaire — on ne peut pas
 * appeler `sendOrderConfirmation` sans charger ce module, donc sans inscrire son gabarit.
 *
 * Destiné à partir dans `echoppe-core` (ADR-0033) ; il ne doit rien gagner de générique.
 */

// ============================================
// GABARITS
// ============================================

registerEmailTemplate('order-confirmation', (data) =>
  emailLayout({
    title: 'Confirmation de commande',
    content: `
      <p>Bonjour${data.customerName ? ` ${data.customerName}` : ''},</p>
      <p>Merci pour votre commande <strong>#${data.orderNumber}</strong> !</p>
      <p>Nous avons bien reçu votre paiement de <strong>${data.total} €</strong>.</p>
      <p>Vous recevrez un email dès que votre commande sera expédiée.</p>
      ${data.orderUrl ? `<p><a href="${data.orderUrl}" class="button">Voir ma commande</a></p>` : ''}
    `,
    footer: `${data.shopName ?? 'Notre boutique'}`,
  }),
);

registerEmailTemplate('shipment', (data) =>
  emailLayout({
    title: 'Votre commande est expédiée !',
    extraStyles: `
      .tracking { background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0; }
    `,
    content: `
      <p>Bonjour${data.customerName ? ` ${data.customerName}` : ''},</p>
      <p>Bonne nouvelle ! Votre commande <strong>#${data.orderNumber}</strong> a été expédiée.</p>
      ${
        data.trackingNumber
          ? `
      <div class="tracking">
        <p><strong>Numéro de suivi :</strong> ${data.trackingNumber}</p>
        ${data.carrier ? `<p><strong>Transporteur :</strong> ${data.carrier}</p>` : ''}
      </div>
      `
          : ''
      }
      ${data.trackingUrl ? `<p><a href="${data.trackingUrl}" class="button">Suivre mon colis</a></p>` : ''}
    `,
    footer: `${data.shopName ?? 'Notre boutique'}`,
  }),
);

registerEmailTemplate('welcome', (data) =>
  emailLayout({
    title: 'Bienvenue !',
    content: `
      <p>Bonjour${data.customerName ? ` ${data.customerName}` : ''},</p>
      <p>Merci de vous être inscrit sur ${data.shopName ?? 'notre boutique'} !</p>
      <p>Votre compte a bien été créé. Vous pouvez maintenant :</p>
      <ul>
        <li>Suivre vos commandes</li>
        <li>Gérer vos adresses</li>
        <li>Sauvegarder vos favoris</li>
      </ul>
      ${data.shopUrl ? `<p><a href="${data.shopUrl}" class="button">Découvrir la boutique</a></p>` : ''}
    `,
    footer: `${data.shopName ?? 'Notre boutique'}`,
  }),
);

// ============================================
// HELPERS TYPÉS PAR ACTION
// ============================================

export interface OrderEmailData {
  customerEmail: string;
  customerName?: string;
  orderNumber: string;
  total: string;
  orderUrl?: string;
}

/**
 * Email de confirmation de commande
 */
export async function sendOrderConfirmation(data: OrderEmailData): Promise<EmailResult> {
  return sendEmail({
    to: data.customerEmail,
    subject: `Confirmation de votre commande #${data.orderNumber}`,
    template: 'order-confirmation',
    data: {
      customerName: data.customerName,
      orderNumber: data.orderNumber,
      total: data.total,
      orderUrl: data.orderUrl,
    },
  });
}

export interface ShipmentEmailData {
  customerEmail: string;
  customerName?: string;
  orderNumber: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
}

/**
 * Email de notification d'expédition
 */
export async function sendShipmentNotification(data: ShipmentEmailData): Promise<EmailResult> {
  return sendEmail({
    to: data.customerEmail,
    subject: `Votre commande #${data.orderNumber} a été expédiée`,
    template: 'shipment',
    data: {
      customerName: data.customerName,
      orderNumber: data.orderNumber,
      trackingNumber: data.trackingNumber,
      trackingUrl: data.trackingUrl,
      carrier: data.carrier,
    },
  });
}

export interface WelcomeEmailData {
  customerEmail: string;
  customerName?: string;
}

/**
 * Email de bienvenue après inscription
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<EmailResult> {
  return sendEmail({
    to: data.customerEmail,
    subject: 'Bienvenue !',
    template: 'welcome',
    data: {
      customerName: data.customerName,
    },
  });
}
