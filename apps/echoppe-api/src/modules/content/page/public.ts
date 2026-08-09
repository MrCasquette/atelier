import { Elysia, t } from 'elysia';
import { withNotFound, withReadErrors } from '../../../lib/response';
import { models } from '../../../model';
import { findPublishedPageBySlug, listPublishedPages } from './service';

// Lecture storefront du module content (page builder). Public : seules les pages `published`
// sont visibles. Une page renvoie ses sections (blocs) ordonnées et résolues.

export const pagesRoutes = new Elysia({ prefix: '/pages', detail: { tags: ['Pages'] } })
  // Registre central des modèles nommés → components.schemas.
  .use(models)

  // GET /pages/ - Aperçu des pages publiées (navigation, plan de site).
  .get('/', () => listPublishedPages(), { response: withReadErrors({ 200: 'PageList' }) })

  // GET /pages/by-slug/:slug - Page publiée avec ses blocs ordonnés.
  .get(
    '/by-slug/:slug',
    async ({ params, status }) => {
      const found = await findPublishedPageBySlug(params.slug);
      if (!found) return status(404, { message: 'Page introuvable' });

      return found;
    },
    {
      params: t.Object({ slug: t.String() }),
      response: withNotFound({ 200: 'Page' }),
    },
  );
