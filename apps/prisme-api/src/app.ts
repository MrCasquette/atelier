import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';

// Application Elysia PURE : construction des routes et plugins, sans aucun effet de bord de
// bootstrap — ni `listen`, ni migrations, ni timers (cf. `index.ts`). Importable telle quelle dans
// les tests via `app.handle(request)`.
//
// Ce qu'elle ne fait PAS encore, et qui n'est pas un oubli :
//
// - **pas de gestionnaire d'erreurs.** Celui d'Échoppe convertit vers un contrat de faute qui
//   appartient à Échoppe (`@echoppe/core`, ADR-0050). Prisme aura le sien ; le rendre partagé est
//   une décision, pas un copier-coller.
// - **pas d'en-têtes de sécurité.** Le plugin d'Échoppe est product-agnostique et le dupliquer ici
//   créerait la deuxième occurrence — donc l'extraction vers un paquet partagé. C'est le bon
//   geste, mais c'est le sien, pas celui de ce lot.
// - **pas de CORS.** Il n'y a pas encore de front à autoriser, et une liste d'origines écrite
//   d'avance est une liste que personne ne vérifie.
export const app = new Elysia()
  .use(
    openapi({
      // `/-/` : espace réservé aux surfaces d'exploitation (ADR-0052). Un premier segment `-` n'est
      // jamais une ressource, donc aucune route de contenu ne peut entrer en collision.
      path: '/-/docs',
      scalar: { theme: 'bluePlanet', darkMode: true },
      documentation: {
        info: {
          title: 'Prisme API',
          version: '0.0.0',
          description: 'CMS headless config-as-code',
        },
        tags: [{ name: 'General', description: 'Informations générales' }],
      },
    }),
  )
  .get('/', () => ({ name: 'Prisme API', version: '0.0.0' }), {
    detail: { tags: ['General'], summary: 'Informations API' },
  })
  .get('/-/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }), {
    detail: { tags: ['General'], summary: 'Health check' },
  });

export type App = typeof app;
