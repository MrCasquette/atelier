import { and, asc, db, eq, page, section } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { models } from '../models';
import { withNotFound, withReadErrors } from '../utils/responses';

// Lecture storefront du module content (page builder). Public : seules les pages `published`
// sont visibles. Une page renvoie ses sections (blocs) ordonnées et résolues.

export const pagesRoutes = new Elysia({ prefix: '/pages', detail: { tags: ['Pages'] } })
  // Registre central des modèles nommés → components.schemas.
  .use(models)

  // GET /pages/ - Aperçu des pages publiées (navigation, plan de site).
  .get(
    '/',
    async () => {
      return db
        .select({ id: page.id, slug: page.slug, title: page.title })
        .from(page)
        .where(eq(page.status, 'published'))
        .orderBy(asc(page.title));
    },
    { response: withReadErrors({ 200: 'PageList' }) },
  )

  // GET /pages/by-slug/:slug - Page publiée avec ses blocs ordonnés.
  .get(
    '/by-slug/:slug',
    async ({ params, status }) => {
      const [pageRow] = await db
        .select()
        .from(page)
        .where(and(eq(page.slug, params.slug), eq(page.status, 'published')));

      if (!pageRow) {
        return status(404, { message: 'Page introuvable' });
      }

      const sections = await db
        .select({ id: section.id, type: section.type, data: section.data })
        .from(section)
        .where(eq(section.page, pageRow.id))
        .orderBy(asc(section.sort));

      return {
        id: pageRow.id,
        slug: pageRow.slug,
        title: pageRow.title,
        seoTitle: pageRow.seoTitle,
        seoDescription: pageRow.seoDescription,
        status: pageRow.status,
        sections,
      };
    },
    {
      params: t.Object({ slug: t.String() }),
      response: withNotFound({ 200: 'Page' }),
    },
  );
