import { faults } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { rateLimit } from 'elysia-rate-limit';
import { faultBody } from '../../lib/fault';
import { strictRateLimitOptions } from '../../lib/rate-limit';
import { messageSchema, withRateLimitErrors, withServiceErrors } from '../../lib/response';
import { models } from '../../model';
import { sendContactMessage } from './service';

const contactBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  email: t.String({ format: 'email' }),
  subject: t.String({ minLength: 1, maxLength: 200 }),
  message: t.String({ minLength: 10, maxLength: 5000 }),
});

export const contactRoutes = new Elysia({ prefix: '/contact' })
  .use(models)
  .use(rateLimit(strictRateLimitOptions))
  .post(
    '/',
    async ({ body, status }) => {
      const result = await sendContactMessage(body);

      switch (result.outcome) {
        // RÉDUCTION SÉMANTIQUE, et c'est le seul endroit du dépôt qui en fasse une (ADR-0050).
        //
        // Le domaine distingue toujours ses deux causes — pas d'adresse publique sur le site, aucun
        // fournisseur d'e-mail branché — et il a raison de le faire : elles se corrigent
        // différemment. Mais l'appelant, ici, est un visiteur ANONYME.
        //
        // `configuration_missing` aurait été le code juste par le prédicat. Il est refusé sur cette
        // frontière, et pas seulement à cause de son `target` : le code lui-même apprend à un
        // inconnu qu'une configuration manque, distinction interne dont il n'a aucun usage et qui
        // renseigne sur l'état de l'installation. Même raisonnement que la fusion
        // d'`invalid_credentials`, qui refuse de dire laquelle des deux causes s'applique.
        //
        // Les surfaces d'administration, elles, gardent `configuration_missing` avec sa cible :
        // leur appelant est authentifié, et il peut agir dessus.
        case 'no-recipient':
        case 'not-configured':
          return status(503, faultBody(faults.serviceUnavailable()));
        // Le tiers a été appelé et a échoué : ce n'est pas une configuration, c'est une panne. Le
        // 500 du socle reste `{ message }` — l'ADR l'exempte (§4), il s'adresse à un opérateur.
        case 'send-failed':
          return status(500, { message: "Une erreur est survenue lors de l'envoi du message." });
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
