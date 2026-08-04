import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';
import type { SmtpCredentials } from './config';
import { renderTemplate } from './templates';
import type {
  CommunicationAdapter,
  CommunicationCredentialStore,
  EmailMessage,
  SendResult,
} from './types';

export class SmtpAdapter implements CommunicationAdapter {
  readonly provider = 'smtp' as const;
  private transporter: Transporter | null = null;
  private initialized = false;

  // DIP : credentials + config d'envoi injectés (registre = base ; test = stub).
  constructor(private readonly store: CommunicationCredentialStore<SmtpCredentials>) {}

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const credentials = await this.store.getCredentials();
    if (credentials) {
      this.transporter = nodemailer.createTransport({
        host: credentials.host,
        port: credentials.port,
        secure: credentials.secure,
        auth: {
          user: credentials.user,
          pass: credentials.pass,
        },
      });
    }
    this.initialized = true;
  }

  async isConfigured(): Promise<boolean> {
    return (await this.store.getCredentials()) !== null;
  }

  async verify(): Promise<boolean> {
    await this.ensureInitialized();

    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  async send(message: EmailMessage): Promise<SendResult> {
    await this.ensureInitialized();

    if (!this.transporter) {
      return { success: false, error: 'SMTP is not configured.' };
    }

    const config = await this.store.getConfig();
    if (!config) {
      return { success: false, error: 'Email configuration is missing.' };
    }

    try {
      const html = renderTemplate(message.template, message.data);

      const info = await this.transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: message.to,
        subject: message.subject,
        html,
        replyTo: message.replyTo ?? config.replyTo,
      });

      return { success: true, messageId: info.messageId };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}
