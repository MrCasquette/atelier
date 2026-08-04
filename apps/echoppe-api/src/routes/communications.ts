import type {
  BrevoCredentials,
  CommunicationConfig,
  CommunicationProvider,
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
import { permissionGuard } from '../plugins/rbac';
import { errorSchema, successSchema } from '../utils/responses';

// Body schemas
const resendConfigBody = t.Object({
  apiKey: t.String({ minLength: 1 }),
  fromEmail: t.String({ format: 'email' }),
  fromName: t.String({ minLength: 1 }),
  replyTo: t.Optional(t.String({ format: 'email' })),
  isEnabled: t.Optional(t.Boolean()),
});

const brevoConfigBody = t.Object({
  apiKey: t.String({ minLength: 1 }),
  fromEmail: t.String({ format: 'email' }),
  fromName: t.String({ minLength: 1 }),
  replyTo: t.Optional(t.String({ format: 'email' })),
  isEnabled: t.Optional(t.Boolean()),
});

const smtpConfigBody = t.Object({
  host: t.String({ minLength: 1 }),
  port: t.Number({ minimum: 1, maximum: 65535 }),
  secure: t.Boolean(),
  user: t.String({ minLength: 1 }),
  pass: t.String({ minLength: 1 }),
  fromEmail: t.String({ format: 'email' }),
  fromName: t.String({ minLength: 1 }),
  replyTo: t.Optional(t.String({ format: 'email' })),
  isEnabled: t.Optional(t.Boolean()),
});

const testEmailBody = t.Object({
  // Littéraux explicites (l'inférence Eden exige des TLiteral précis) — garder en phase avec COMMUNICATION_PROVIDERS.
  provider: t.Union([t.Literal('resend'), t.Literal('brevo'), t.Literal('smtp')]),
  to: t.String({ format: 'email' }),
});

// Response schemas

const providerFieldSchema = t.Object({
  key: t.String(),
  label: t.String(),
  type: t.String(),
  placeholder: t.Optional(t.String()),
  options: t.Optional(t.Array(t.Object({ value: t.String(), label: t.String() }))),
});

const providerStatusSchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.String(),
  recommended: t.Optional(t.Boolean()),
  fields: t.Array(providerFieldSchema),
  isConfigured: t.Boolean(),
  isEnabled: t.Boolean(),
  encryptionReady: t.Boolean(),
});

const testResultSchema = t.Object({
  success: t.Boolean(),
  messageId: t.Optional(t.String()),
  error: t.Optional(t.String()),
});

// Provider metadata
const providerMeta: Record<
  CommunicationProvider,
  {
    name: string;
    description: string;
    recommended?: boolean;
    fields: {
      key: string;
      label: string;
      type: string;
      placeholder?: string;
      options?: { value: string; label: string }[];
    }[];
  }
> = {
  resend: {
    name: 'Resend',
    description: "Service d'email transactionnel moderne et fiable",
    recommended: true,
    fields: [
      { key: 'apiKey', label: 'Clé API', type: 'password', placeholder: 're_...' },
      {
        key: 'fromEmail',
        label: 'Email expéditeur',
        type: 'email',
        placeholder: 'contact@votredomaine.fr',
      },
      { key: 'fromName', label: 'Nom expéditeur', type: 'text', placeholder: 'Ma Boutique' },
      {
        key: 'replyTo',
        label: 'Email de réponse (optionnel)',
        type: 'email',
        placeholder: 'reponse@votredomaine.fr',
      },
    ],
  },
  brevo: {
    name: 'Brevo',
    description: 'Solution française (ex-Sendinblue), 300 emails/jour gratuits',
    fields: [
      { key: 'apiKey', label: 'Clé API', type: 'password', placeholder: 'xkeysib-...' },
      {
        key: 'fromEmail',
        label: 'Email expéditeur',
        type: 'email',
        placeholder: 'contact@votredomaine.fr',
      },
      { key: 'fromName', label: 'Nom expéditeur', type: 'text', placeholder: 'Ma Boutique' },
      {
        key: 'replyTo',
        label: 'Email de réponse (optionnel)',
        type: 'email',
        placeholder: 'reponse@votredomaine.fr',
      },
    ],
  },
  smtp: {
    name: 'SMTP',
    description: 'Serveur SMTP personnalisé (OVH, Ionos, Gmail...)',
    fields: [
      { key: 'host', label: 'Serveur SMTP', type: 'text', placeholder: 'ssl0.ovh.net' },
      {
        key: 'port',
        label: 'Port',
        type: 'select',
        options: [
          { value: '465', label: '465 (SSL)' },
          { value: '587', label: '587 (TLS)' },
          { value: '25', label: '25 (non sécurisé)' },
        ],
      },
      {
        key: 'secure',
        label: 'Connexion sécurisée (SSL)',
        type: 'checkbox',
      },
      { key: 'user', label: 'Identifiant', type: 'text', placeholder: 'contact@votredomaine.fr' },
      { key: 'pass', label: 'Mot de passe', type: 'password' },
      {
        key: 'fromEmail',
        label: 'Email expéditeur',
        type: 'email',
        placeholder: 'contact@votredomaine.fr',
      },
      { key: 'fromName', label: 'Nom expéditeur', type: 'text', placeholder: 'Ma Boutique' },
      {
        key: 'replyTo',
        label: 'Email de réponse (optionnel)',
        type: 'email',
        placeholder: 'reponse@votredomaine.fr',
      },
    ],
  },
};

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
