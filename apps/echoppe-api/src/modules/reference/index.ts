import { faults } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { faultBody } from '../../lib/fault';
import { withAuthErrors } from '../../lib/response';
import { models } from '../../model';
import { permissionGuard } from '../auth/rbac';
import { listReferenceTargets, projectTarget, searchTarget } from './targets';

// Surface du registre de cibles référençables (ADR-0032). Remplace huit appels catalogue codés en
// dur dans l'administration (`useCatalogRef`) par une surface que Prisme sert telle quelle avec
// ses propres entités.
//
// Garde `content:read` : c'est l'écran du page builder qui pose ces liens. La projection rendue —
// `{ id, slug, name }` — est déjà publique au storefront pour toutes les cibles inscrites, donc
// aucun droit sur `product` ou `category` n'est contourné.

const DEFAULT_SEARCH_LIMIT = 20;

const targetSummarySchema = t.Object({
  name: t.String({ description: 'Nom stable de la cible, celui que porte un lien.' }),
  label: t.String({ description: "Libellé affiché dans l'administration." }),
  route: t.Nullable(t.String({ description: 'Route déclarée, `:slug` non substitué.' })),
});

const entitySchema = t.Object({
  id: t.String({ format: 'uuid' }),
  slug: t.String(),
  name: t.String(),
  // Rendue pour les cibles dont l'URL ne se dérive pas de la seule route déclarée (ADR-0046) : une
  // entité qui porte son URL, ou dont le lien est une ancre. Sans ce champ, Elysia l'élaguerait à
  // la réponse et le sélecteur ne saurait pas où mène ce qu'il propose.
  url: t.Optional(t.Nullable(t.String())),
});

export const referenceRoutes = new Elysia({
  prefix: '/content/reference-targets',
  detail: { tags: ['Content'] },
})
  .use(models)
  .use(permissionGuard('content', 'read'))

  // GET /content/reference-targets - Les cibles inscrites, dans l'ordre du sélecteur.
  .get('/', () => listReferenceTargets(), {
    permission: true,
    response: withAuthErrors({ 200: t.Array(targetSummarySchema) }),
  })

  // GET /content/reference-targets/:name/options - Recherche par terme libre (sélecteur).
  .get(
    '/:name/options',
    async ({ params, query, status }) => {
      const result = await searchTarget(
        params.name,
        query.search ?? '',
        query.limit ?? DEFAULT_SEARCH_LIMIT,
      );

      return result.outcome === 'unknown-target'
        ? status(404, faultBody(faults.notFound('reference_target')))
        : result.entities;
    },
    {
      permission: true,
      params: t.Object({ name: t.String() }),
      query: t.Object({
        search: t.Optional(t.String()),
        limit: t.Optional(t.Numeric({ minimum: 1 })),
      }),
      response: withAuthErrors({ 200: t.Array(entitySchema), 404: 'ErrorResponse' }),
    },
  )

  // GET /content/reference-targets/:name/entities - Projection d'identifiants déjà stockés : sert
  // au libellé d'une référence sélectionnée, sans avoir à la retrouver par recherche.
  .get(
    '/:name/entities',
    async ({ params, query, status }) => {
      const ids = query.ids ? query.ids.split(',').filter(Boolean) : [];
      const result = await projectTarget(params.name, ids);

      return result.outcome === 'unknown-target'
        ? status(404, faultBody(faults.notFound('reference_target')))
        : result.entities;
    },
    {
      permission: true,
      params: t.Object({ name: t.String() }),
      query: t.Object({
        ids: t.Optional(t.String({ description: 'UUID séparés par des virgules.' })),
      }),
      response: withAuthErrors({ 200: t.Array(entitySchema), 404: 'ErrorResponse' }),
    },
  );
