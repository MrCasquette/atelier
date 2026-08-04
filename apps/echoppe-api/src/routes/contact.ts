import { company, db, sendContactFormEmail } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { rateLimit } from 'elysia-rate-limit';
import { strictRateLimitOptions } from '../utils/rate-limit';
import { messageSchema, withRateLimitErrors, withServiceErrors } from '../utils/responses';

const contactBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  email: t.String({ format: 'email' }),
  subject: t.String({ minLength: 1, maxLength: 200 }),
  message: t.String({ minLength: 10, maxLength: 5000 }),
});

export const contactRoutes = new Elysia({ prefix: '/contact' })
  .use(rateLimit(strictRateLimitOptions))
  .post(
    '/',
    async ({ body, status }) => {
      const [companyData] = await db.select().from(company).limit(1);

      if (!companyData?.publicEmail) {
        return status(503, {
          message: 'Le formulaire de contact est temporairement indisponible.',
        });
      }

      const result = await sendContactFormEmail({
        adminEmail: companyData.publicEmail,
        senderName: body.name,
        senderEmail: body.email,
        subject: body.subject,
        message: body.message,
      });

      if (!result.success) {
        return status(500, { message: "Une erreur est survenue lors de l'envoi du message." });
      }

      if (result.skipped) {
        return status(503, { message: "Le service d'envoi d'emails n'est pas configuré." });
      }

      return { message: 'Message envoyé avec succès.' };
    },
    {
      body: contactBody,
      response: withRateLimitErrors(
        withServiceErrors({
          200: messageSchema,
        }),
      ),
      detail: {
        tags: ['Contact'],
        summary: 'Envoyer un message via le formulaire de contact',
        description: "Envoie un email à l'adresse de contact de la boutique.",
      },
    },
  );
