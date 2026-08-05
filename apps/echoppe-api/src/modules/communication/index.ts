import type {
  BrevoCredentials,
  CommunicationConfig,
  ResendCredentials,
  SmtpCredentials,
} from '@echoppe/core';
import {
  COMMUNICATION_PROVIDERS,
  communicationLog,
  db,
  getCommunicationAdapter,
  getCommunicationProviderStatus,
  isEncryptionConfigured,
  resetCommunicationAdapters,
  saveCommunicationProviderCredentials,
} from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { errorSchema, successSchema } from '../../lib/response';
import { permissionGuard } from '../../plugins/rbac';
import {
  brevoConfigBody,
  providerStatusSchema,
  resendConfigBody,
  smtpConfigBody,
  testEmailBody,
  testResultSchema,
} from './model';
import { providerMeta } from './provider-meta';

// Configuration des fournisseurs d'e-mail. Le module ne sait PAS envoyer : l'envoi vit dans
// @repo/communication, appelé ici pour vérifier une connexion et enregistrer les identifiants
// chiffrés. Surface entièrement protégée par `communication_config`.

export const communicationsRoutes = new Elysia({
  prefix: '/communications',
  detail: { tags: ['Communications'] },
})

  // === COMMUNICATION CONFIG READ ===
  .use(permissionGuard('communication_config', 'read'))

  // GET /communications/providers - Liste des providers avec statut
  .get(
    '/providers',
    async () => {
      const providers = COMMUNICATION_PROVIDERS;
      const encryptionReady = isEncryptionConfigured();

      const result = await Promise.all(
        providers.map(async (id) => {
          const status = await getCommunicationProviderStatus(id);
          return {
            id,
            ...providerMeta[id],
            ...status,
            encryptionReady,
          };
        }),
      );

      return result;
    },
    { permission: true, response: { 200: t.Array(providerStatusSchema) } },
  )

  // === COMMUNICATION CONFIG UPDATE ===
  .use(permissionGuard('communication_config', 'update'))

  // PUT /communications/providers/resend - Configure Resend
  .put(
    '/providers/resend',
    async ({ body, status }) => {
      if (!isEncryptionConfigured()) {
        return status(400, { message: 'ENCRYPTION_KEY non configurée' });
      }

      const credentials: ResendCredentials = {
        apiKey: body.apiKey,
      };

      const config: CommunicationConfig = {
        fromEmail: body.fromEmail,
        fromName: body.fromName,
        replyTo: body.replyTo,
      };

      await saveCommunicationProviderCredentials(
        'resend',
        credentials,
        config,
        body.isEnabled ?? true,
      );
      resetCommunicationAdapters();

      return { success: true };
    },
    {
      permission: true,
      body: resendConfigBody,
      response: { 200: successSchema, 400: errorSchema },
    },
  )

  // PUT /communications/providers/brevo - Configure Brevo
  .put(
    '/providers/brevo',
    async ({ body, status }) => {
      if (!isEncryptionConfigured()) {
        return status(400, { message: 'ENCRYPTION_KEY non configurée' });
      }

      const credentials: BrevoCredentials = {
        apiKey: body.apiKey,
      };

      const config: CommunicationConfig = {
        fromEmail: body.fromEmail,
        fromName: body.fromName,
        replyTo: body.replyTo,
      };

      await saveCommunicationProviderCredentials(
        'brevo',
        credentials,
        config,
        body.isEnabled ?? true,
      );
      resetCommunicationAdapters();

      return { success: true };
    },
    { permission: true, body: brevoConfigBody, response: { 200: successSchema, 400: errorSchema } },
  )

  // PUT /communications/providers/smtp - Configure SMTP
  .put(
    '/providers/smtp',
    async ({ body, status }) => {
      if (!isEncryptionConfigured()) {
        return status(400, { message: 'ENCRYPTION_KEY non configurée' });
      }

      const credentials: SmtpCredentials = {
        host: body.host,
        port: body.port,
        secure: body.secure,
        user: body.user,
        pass: body.pass,
      };

      const config: CommunicationConfig = {
        fromEmail: body.fromEmail,
        fromName: body.fromName,
        replyTo: body.replyTo,
      };

      await saveCommunicationProviderCredentials(
        'smtp',
        credentials,
        config,
        body.isEnabled ?? true,
      );
      resetCommunicationAdapters();

      return { success: true };
    },
    { permission: true, body: smtpConfigBody, response: { 200: successSchema, 400: errorSchema } },
  )

  // POST /communications/test - Envoyer un email de test
  .post(
    '/test',
    async ({ body, status }) => {
      const adapter = getCommunicationAdapter(body.provider);

      if (!(await adapter.isConfigured())) {
        return status(400, { message: `Provider ${body.provider} non configuré` });
      }

      // Vérifier la connexion
      const isValid = await adapter.verify();
      if (!isValid) {
        return status(400, {
          message: 'Impossible de se connecter au provider. Vérifiez vos identifiants.',
        });
      }

      // Envoyer l'email de test
      const result = await adapter.send({
        to: body.to,
        subject: 'Test de configuration email - Échoppe',
        template: 'welcome',
        data: {
          customerName: 'Administrateur',
          shopName: 'Votre Boutique Échoppe',
          shopUrl: '#',
        },
      });

      // Log le résultat
      await db.insert(communicationLog).values({
        provider: body.provider,
        channel: 'email',
        template: 'welcome',
        recipient: body.to,
        subject: 'Test de configuration email - Échoppe',
        status: result.success ? 'sent' : 'failed',
        providerMessageId: result.messageId,
        error: result.error,
        metadata: { isTest: true },
      });

      return result;
    },
    {
      permission: true,
      body: testEmailBody,
      response: { 200: testResultSchema, 400: errorSchema },
    },
  );
