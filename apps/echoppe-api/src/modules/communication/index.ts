import { Elysia, t } from 'elysia';
import { errorSchema, successSchema } from '../../lib/response';
import { permissionGuard } from '../auth/rbac';
import {
  brevoConfigBody,
  providerStatusSchema,
  resendConfigBody,
  smtpConfigBody,
  testEmailBody,
  testResultSchema,
} from './model';
import { listProviderStatuses, saveProvider, sendTestEmail } from './service';

// Configuration des fournisseurs d'e-mail. Le module ne sait PAS envoyer : l'envoi vit dans
// @repo/communication, appelé par ./service.ts pour vérifier une connexion et enregistrer les
// identifiants chiffrés. Surface entièrement protégée par `communication_config`.
//
// Les trois routes de configuration ne diffèrent que par la forme des identifiants ; c'est
// précisément ce que leur schéma de corps exprime, et tout ce qu'elles ajoutent au service.

const ENCRYPTION_MISSING = { message: 'ENCRYPTION_KEY non configurée' } as const;

export const communicationsRoutes = new Elysia({
  prefix: '/communications',
  detail: { tags: ['Communications'] },
})

  // === COMMUNICATION CONFIG READ ===
  .use(permissionGuard('communication_config', 'read'))

  // GET /communications/providers - Liste des providers avec statut
  .get('/providers', () => listProviderStatuses(), {
    permission: true,
    response: { 200: t.Array(providerStatusSchema) },
  })

  // === COMMUNICATION CONFIG UPDATE ===
  .use(permissionGuard('communication_config', 'update'))

  // PUT /communications/providers/resend - Configure Resend
  .put(
    '/providers/resend',
    async ({ body, status }) => {
      const result = await saveProvider(
        'resend',
        { apiKey: body.apiKey },
        { fromEmail: body.fromEmail, fromName: body.fromName, replyTo: body.replyTo },
        body.isEnabled ?? true,
      );

      return result.outcome === 'encryption-missing'
        ? status(400, ENCRYPTION_MISSING)
        : { success: true };
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
      const result = await saveProvider(
        'brevo',
        { apiKey: body.apiKey },
        { fromEmail: body.fromEmail, fromName: body.fromName, replyTo: body.replyTo },
        body.isEnabled ?? true,
      );

      return result.outcome === 'encryption-missing'
        ? status(400, ENCRYPTION_MISSING)
        : { success: true };
    },
    { permission: true, body: brevoConfigBody, response: { 200: successSchema, 400: errorSchema } },
  )

  // PUT /communications/providers/smtp - Configure SMTP
  .put(
    '/providers/smtp',
    async ({ body, status }) => {
      const result = await saveProvider(
        'smtp',
        {
          host: body.host,
          port: body.port,
          secure: body.secure,
          user: body.user,
          pass: body.pass,
        },
        { fromEmail: body.fromEmail, fromName: body.fromName, replyTo: body.replyTo },
        body.isEnabled ?? true,
      );

      return result.outcome === 'encryption-missing'
        ? status(400, ENCRYPTION_MISSING)
        : { success: true };
    },
    { permission: true, body: smtpConfigBody, response: { 200: successSchema, 400: errorSchema } },
  )

  // POST /communications/test - Envoyer un email de test
  .post(
    '/test',
    async ({ body, status }) => {
      const result = await sendTestEmail(body.provider, body.to);

      switch (result.outcome) {
        case 'not-configured':
          return status(400, { message: `Provider ${body.provider} non configuré` });
        case 'unreachable':
          return status(400, {
            message: 'Impossible de se connecter au provider. Vérifiez vos identifiants.',
          });
        case 'sent':
          return result.result;
      }
    },
    {
      permission: true,
      body: testEmailBody,
      response: { 200: testResultSchema, 400: errorSchema },
    },
  );
