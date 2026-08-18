import { faults } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { faultBody } from '../../lib/fault';
import { mailPlugin } from '../../lib/mail';
import { successSchema } from '../../lib/response';
import { models } from '../../model';
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

const ENCRYPTION_MISSING = faultBody(faults.configurationMissing('ENCRYPTION_KEY'));

export const communicationsRoutes = new Elysia({
  prefix: '/communications',
  detail: { tags: ['Communications'] },
})
  .use(mailPlugin)
  .use(models)

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
    async ({ body, mail, status }) => {
      const result = await saveProvider(
        mail,
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
      response: { 200: successSchema, 400: 'ErrorResponse' },
    },
  )

  // PUT /communications/providers/brevo - Configure Brevo
  .put(
    '/providers/brevo',
    async ({ body, mail, status }) => {
      const result = await saveProvider(
        mail,
        'brevo',
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
      body: brevoConfigBody,
      response: { 200: successSchema, 400: 'ErrorResponse' },
    },
  )

  // PUT /communications/providers/smtp - Configure SMTP
  .put(
    '/providers/smtp',
    async ({ body, mail, status }) => {
      const result = await saveProvider(
        mail,
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
    {
      permission: true,
      body: smtpConfigBody,
      response: { 200: successSchema, 400: 'ErrorResponse' },
    },
  )

  // POST /communications/test - Envoyer un email de test
  .post(
    '/test',
    async ({ body, mail, status }) => {
      const result = await sendTestEmail(mail, body.provider, body.to);

      switch (result.outcome) {
        case 'not-configured':
          return status(400, faultBody(faults.configurationMissing(body.provider)));
        case 'unreachable':
          // Le tiers a répondu, mal : ce n'est ni une absence de configuration ni une faute de
          // l'appelant. `operation` le nomme sans exposer le diagnostic du prestataire.
          return status(400, faultBody(faults.externalOperationFailed('communication.test')));
        case 'sent':
          return result.result;
      }
    },
    {
      permission: true,
      body: testEmailBody,
      response: { 200: testResultSchema, 400: 'ErrorResponse' },
    },
  );
