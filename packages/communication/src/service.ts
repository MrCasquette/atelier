import type { CommunicationRegistry } from './registry';
import type {
  CommunicationAdapter,
  CommunicationJournal,
  CommunicationProvider,
  EmailTemplate,
  SendResult,
  SiteIdentity,
} from './types';

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

/** Ce dont l'envoi a besoin, et que le produit compose à son démarrage. */
export interface CommunicationDeps {
  readonly registry: CommunicationRegistry;
  /**
   * Un provider est-il utilisable ? Adossé à la base en production — configuré ET activé — mais
   * c'est une dépendance comme les autres : sans elle, `send` resterait soudé à Postgres par ce
   * seul chemin, et le reste de l'injection n'aurait servi à rien.
   */
  readonly isReady: (provider: CommunicationProvider) => Promise<boolean>;
  /** L'identité du site, relue à chaque envoi : elle change sans redémarrage. */
  readonly siteIdentity: () => Promise<SiteIdentity>;
  readonly journal: CommunicationJournal;
}

/**
 * L'envoi d'e-mails, sous sa forme d'acteur : il tient des dépendances, donc c'est une classe
 * (philosophy §3). Il remplace un jeu de fonctions libres adossées à un singleton de module.
 *
 * Ce que ça change concrètement : le chemin d'envoi devient testable. Substituer un faux registre
 * et un journal en mémoire suffit à exercer `send` de bout en bout — sans base, et surtout sans
 * risque qu'un test muni de credentials valides appelle la véritable API d'un provider.
 */
export class CommunicationService {
  constructor(private readonly deps: CommunicationDeps) {}

  /** L'adapter d'un provider donné — pour vérifier une connexion, pas pour envoyer. */
  adapter(provider: CommunicationProvider): CommunicationAdapter {
    return this.deps.registry.get(provider);
  }

  /** Purge les instances mémoïsées — après une rotation de credentials. */
  reset(): void {
    this.deps.registry.reset();
  }

  availableProviders(): Promise<CommunicationProvider[]> {
    return this.deps.registry.available(this.deps.isReady);
  }

  /** Le premier provider configuré ET activé, dans l'ordre déclaré par `COMMUNICATION_PROVIDERS`. */
  private async activeAdapter(): Promise<CommunicationAdapter | null> {
    const [first] = await this.availableProviders();
    return first ? this.deps.registry.get(first) : null;
  }

  /**
   * Envoie un e-mail par le provider actif, et consigne le résultat.
   *
   * Aucun provider configuré n'est pas une faute : une boutique neuve n'en a pas encore. L'appel
   * répond `skipped` et l'appelant décide — l'invitation d'un utilisateur, par exemple, rend alors
   * le lien à celui qui invite plutôt que de le laisser dans le vide.
   */
  async send(params: SendEmailParams): Promise<EmailResult> {
    const adapter = await this.activeAdapter();
    if (!adapter) return { success: true, skipped: true };

    const site = await this.deps.siteIdentity();
    const data = { siteName: site.name, siteUrl: site.url, ...params.data };

    const result = await adapter.send({
      to: params.to,
      subject: params.subject,
      template: params.template,
      data,
      replyTo: params.replyTo,
    });

    await this.deps.journal.record({
      provider: adapter.provider,
      template: params.template,
      recipient: params.to,
      subject: params.subject,
      status: result.success ? 'sent' : 'failed',
      providerMessageId: result.messageId,
      error: result.error,
      metadata: data,
    });

    return result;
  }

  // ─── Gabarits du socle ───────────────────────────────────────────────────────────────────────
  //
  // Les envois propres au commerce (commande, expédition, bienvenue boutique) n'ont rien à faire
  // ici : ils vivent dans le cœur du produit, avec les gabarits qu'ils inscrivent.

  sendResetPassword(data: ResetPasswordEmailData): Promise<EmailResult> {
    return this.send({
      to: data.email,
      subject: 'Réinitialisation de votre mot de passe',
      template: 'reset-password',
      data: { resetUrl: data.resetUrl, expiresIn: data.expiresIn ?? '1 heure' },
    });
  }

  /** Invitation à poser son mot de passe (ADR-0048). */
  sendUserInvitation(data: UserInvitationEmailData): Promise<EmailResult> {
    return this.send({
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

  sendContactForm(data: ContactFormEmailData): Promise<EmailResult> {
    return this.send({
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
}

export interface ResetPasswordEmailData {
  email: string;
  resetUrl: string;
  expiresIn?: string;
}

export interface UserInvitationEmailData {
  email: string;
  firstName: string;
  inviteUrl: string;
  /** Qui invite — le message doit le dire, sinon il ressemble à un hameçonnage. */
  invitedBy?: string;
  expiresIn?: string;
}

export interface ContactFormEmailData {
  adminEmail: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  subject?: string;
  message: string;
}
