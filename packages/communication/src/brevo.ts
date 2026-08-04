import { BrevoClient } from '@getbrevo/brevo';
import type { BrevoCredentials } from './config';
import { renderTemplate } from './templates';
import type {
  CommunicationAdapter,
  CommunicationCredentialStore,
  EmailMessage,
  SendResult,
} from './types';

export class BrevoAdapter implements CommunicationAdapter {
  readonly provider = 'brevo' as const;
  private client: BrevoClient | null = null;
  private initialized = false;

  // DIP : credentials + config d'envoi injectés (registre = base ; test = stub).
  constructor(private readonly store: CommunicationCredentialStore<BrevoCredentials>) {}

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const credentials = await this.store.getCredentials();
    if (credentials) {
      this.client = new BrevoClient({ apiKey: credentials.apiKey });
    }
    this.initialized = true;
  }

  async isConfigured(): Promise<boolean> {
    return (await this.store.getCredentials()) !== null;
  }

  async verify(): Promise<boolean> {
    await this.ensureInitialized();

    if (!this.client) {
      return false;
    }

    try {
      await this.client.account.getAccount();
      return true;
    } catch {
      return false;
    }
  }

  async send(message: EmailMessage): Promise<SendResult> {
    await this.ensureInitialized();

    if (!this.client) {
      return { success: false, error: 'Brevo is not configured.' };
    }

    const config = await this.store.getConfig();
    if (!config) {
      return { success: false, error: 'Email configuration is missing.' };
    }

    try {
      const html = renderTemplate(message.template, message.data);
      const replyToEmail = message.replyTo ?? config.replyTo;

      const response = await this.client.transactionalEmails.sendTransacEmail({
        sender: { name: config.fromName, email: config.fromEmail },
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: html,
        ...(replyToEmail ? { replyTo: { email: replyToEmail } } : {}),
      });

      return { success: true, messageId: response.messageId };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}
