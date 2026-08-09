import { Elysia, t } from 'elysia';
import { rateLimit } from 'elysia-rate-limit';
import { strictRateLimitOptions } from '../../lib/rate-limit';
import { messageSchema, withRateLimitErrors, withServiceErrors } from '../../lib/response';
import { sendContactMessage } from './service';

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
      const result = await sendContactMessage(body);

      switch (result.outcome) {
        case 'no-recipient':
          return status(503, {
            message: 'Le formulaire de contact est temporairement indisponible.',
          });
        case 'send-failed':
          return status(500, { message: "Une erreur est survenue lors de l'envoi du message." });
        case 'not-configured':
          return status(503, { message: "Le service d'envoi d'emails n'est pas configuré." });
        case 'sent':
          return { message: 'Message envoyé avec succès.' };
      }
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
