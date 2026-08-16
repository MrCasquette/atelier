import { faults } from '@echoppe/core';
import {
  createPage,
  deletePage,
  findPage,
  listPages,
  replaceSections,
  updatePage,
} from '@repo/pages';
import { Elysia, t } from 'elysia';
import { faultBody } from '../../../lib/fault';
import { successSchema, withCrudErrors } from '../../../lib/response';
import { models } from '../../../model';
import { permissionGuard } from '../../auth/rbac';
import { sectionInputSchema } from './model';

// Administration du page builder. Protégé par RBAC `content`. Les sections d'une page sont
// remplacées d'un bloc via PUT (façon « save de la dynamic zone ») : plus simple et atomique que
// du CRUD granulaire de sections.

const uuidParam = t.Object({ id: t.String({ format: 'uuid' }) });
const pageStatus = t.Union([t.Literal('draft'), t.Literal('published')]);

// Schémas de réponse admin (inline — hors surface storefront).
const adminSectionSchema = t.Object({
  id: t.String(),
  name: t.Nullable(t.String()),
  type: t.String(),
  data: t.Unknown(),
  sort: t.Number(),
});

const adminPageListItem = t.Object({
  id: t.String(),
  slug: t.String(),
  title: t.String(),
  status: pageStatus,
  dateCreated: t.Date(),
  dateUpdated: t.Date(),
});

const adminPageDetail = t.Object({
  id: t.String(),
  slug: t.String(),
  title: t.String(),
  seoTitle: t.Nullable(t.String()),
  seoDescription: t.Nullable(t.String()),
  status: pageStatus,
  dateCreated: t.Date(),
  dateUpdated: t.Date(),
  sections: t.Array(adminSectionSchema),
});

const pageCreateBody = t.Object({
  slug: t.String({ minLength: 1, maxLength: 150 }),
  title: t.String({ minLength: 1, maxLength: 200 }),
  seoTitle: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
  seoDescription: t.Optional(t.Nullable(t.String())),
  status: t.Optional(pageStatus),
});

const pagePatchBody = t.Object({
  slug: t.Optional(t.String({ minLength: 1, maxLength: 150 })),
  title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
  seoTitle: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
  seoDescription: t.Optional(t.Nullable(t.String())),
  status: t.Optional(pageStatus),
});

export const pageAdminRoutes = new Elysia({ prefix: '/content', detail: { tags: ['Content'] } })
  .use(models)
  // === READ ===
  .use(permissionGuard('content', 'read'))

  .get('/pages', () => listPages(), {
    permission: true,
    response: { 200: t.Array(adminPageListItem) },
  })

  .get(
    '/pages/:id',
    async ({ params, status }) => {
      const found = await findPage(params.id);
      if (!found) return status(404, faultBody(faults.notFound('page')));

      return found;
    },
    { permission: true, params: uuidParam, response: withCrudErrors({ 200: adminPageDetail }) },
  )

  // === CREATE ===
  .use(permissionGuard('content', 'create'))

  .post(
    '/pages',
    async ({ body, status }) => {
      const result = await createPage(body);

      if (result.outcome === 'slug-taken') {
        return status(409, faultBody(faults.alreadyExists('page', 'slug')));
      }
      return result.page;
    },
    {
      permission: true,
      body: pageCreateBody,
      response: withCrudErrors({ 200: adminPageDetail, 409: 'ErrorResponse' }),
    },
  )

  // === UPDATE ===
  .use(permissionGuard('content', 'update'))

  .patch(
    '/pages/:id',
    async ({ params, body, status }) => {
      const updated = await updatePage(params.id, body);
      if (!updated) return status(404, faultBody(faults.notFound('page')));

      return updated;
    },
    {
      permission: true,
      params: uuidParam,
      body: pagePatchBody,
      response: withCrudErrors({ 200: adminPageDetail }),
    },
  )

  // PUT /content/pages/:id/sections - Remplace toutes les sections (ordre = index du tableau).
  .put(
    '/pages/:id/sections',
    async ({ params, body, status }) => {
      const result = await replaceSections(params.id, body);

      switch (result.outcome) {
        case 'page-not-found':
          return status(404, faultBody(faults.notFound('page')));
        case 'invalid':
          return status(422, { message: result.errors.join(' ; ') });
        case 'replaced':
          return result.sections;
      }
    },
    {
      permission: true,
      params: uuidParam,
      body: t.Array(sectionInputSchema),
      response: withCrudErrors({ 200: t.Array(adminSectionSchema) }),
    },
  )

  // === DELETE ===
  .use(permissionGuard('content', 'delete'))

  .delete(
    '/pages/:id',
    async ({ params, status }) => {
      const deleted = await deletePage(params.id);
      if (!deleted) return status(404, faultBody(faults.notFound('page')));

      return { success: true };
    },
    { permission: true, params: uuidParam, response: withCrudErrors({ 200: successSchema }) },
  );
