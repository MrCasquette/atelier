import {
  findDeclaration,
  findEntityRowBySlug,
  findSingletonRow,
  listEntityRows,
} from '@repo/entities';
import { Elysia, t } from 'elysia';
import { getPaginationParams, paginationQuery } from '../../../lib/pagination';
import { withNotFound } from '../../../lib/response';
import { models } from '../../../model';

// Lecture front des entités. Route GÉNÉRIQUE, décidée par le contrat figé (ADR-0027, amendement) :
// des routes dérivées du registre rendraient l'OpenAPI dépendant de l'installation, donc
// `@echoppe/client` ingénérable depuis un contrat unique.
//
// Publique, comme les pages : une entité déclarée est du contenu destiné au front. Ce qui doit
// rester privé se règle en RBAC côté administration, pas en cachant la route.

const nameParam = t.Object({ name: t.String() });

export const entityPublicRoutes = new Elysia({
  prefix: '/entities',
  detail: { tags: ['Entities'] },
})
  .use(models)

  // GET /entities/:name — liste d'une entité de liste, OU l'unique occurrence d'un singleton.
  .get(
    '/:name',
    async ({ params, query, status }) => {
      const found = await findDeclaration(params.name);
      // Non déclarée : erreur de code, pas état du produit (ADR-0039).
      if (found.outcome === 'undeclared') return status(404, { message: 'Entité introuvable' });

      if (found.declaration.singleton) {
        // Déclaré mais jamais rempli → `200 { data: null }`. Un singleton EXISTE dès qu'il est
        // déclaré : c'est la déclaration qui le fait exister, pas sa première écriture.
        return { data: await findSingletonRow(found.declaration) };
      }

      const { page, limit, offset } = getPaginationParams(query);
      const { rows, total } = await listEntityRows(found.declaration, limit, offset);
      const totalPages = Math.ceil(total / limit);
      return {
        data: rows,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    },
    {
      params: nameParam,
      query: paginationQuery,
      response: withNotFound({ 200: 'EntityResult' }),
    },
  )

  // GET /entities/:name/:slug — une occurrence. Un singleton n'a pas de slug : son identité est son
  // nom, il se lit sur la route sans slug.
  .get(
    '/:name/:slug',
    async ({ params, status }) => {
      const found = await findDeclaration(params.name);
      if (found.outcome === 'undeclared' || found.declaration.singleton) {
        return status(404, { message: 'Entité introuvable' });
      }

      const row = await findEntityRowBySlug(found.declaration, params.slug);
      if (!row) return status(404, { message: 'Occurrence introuvable' });

      return { data: row };
    },
    {
      params: t.Object({ name: t.String(), slug: t.String() }),
      response: withNotFound({ 200: 'EntityResult' }),
    },
  );
