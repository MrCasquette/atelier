import { and, category, db, eq, product } from '@echoppe/core';
import { slugify } from '@echoppe/shared';
import { Elysia, t } from 'elysia';
import { getClientIp, logAudit } from '../lib/audit';
import { models } from '../models';
import { isPrivilegedRequest, permissionGuard } from '../plugins/rbac';
import {
  notFound,
  successSchema,
  withAuthErrors,
  withCrudErrors,
  withNotFound,
  withReadErrors,
} from '../utils/responses';
import { visibilityFilter } from '../utils/visibility';
import { productSubListQuery, queryProductCards } from './products/shared';

// Schéma d'entité catégorie → src/models/category.ts

const batchOrderBody = t.Array(
  t.Object({
    id: t.String({ format: 'uuid' }),
    parent: t.Nullable(t.String({ format: 'uuid' })),
    sortOrder: t.Number(),
  }),
);

const categoryCreateBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  description: t.Optional(t.String()),
  parent: t.Optional(t.String({ format: 'uuid' })),
  image: t.Optional(t.String({ format: 'uuid' })),
  sortOrder: t.Optional(t.Number({ default: 0 })),
  isVisible: t.Optional(t.Boolean({ default: true })),
});

const categoryUpdateBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  description: t.Optional(t.String()),
  parent: t.Optional(t.String({ format: 'uuid' })),
  image: t.Optional(t.String({ format: 'uuid' })),
  sortOrder: t.Optional(t.Number({ default: 0 })),
  isVisible: t.Optional(t.Boolean({ default: true })),
});

const categoryParams = t.Object({
  id: t.String({ format: 'uuid' }),
});

// Schemas de réponse spécifiques
const batchSuccessSchema = t.Object({ success: t.Boolean(), count: t.Number() });

// (produits-liste : réutilise le modèle ProductList du catalog, plus de doublon ici)

export const categoriesRoutes = new Elysia({
  prefix: '/categories',
  detail: { tags: ['Categories'] },
})
  // Registre central des modèles nommés → components.schemas.
  .use(models)

  // === PUBLIC ROUTES ===

  // GET /categories - List (public visible-only ; admin/API voit tout).
  .get(
    '/',
    async ({ cookie, headers }) => {
      const all = await isPrivilegedRequest(
        cookie as Record<string, { value?: string }>,
        headers.authorization,
      );
      return db
        .select()
        .from(category)
        .where(visibilityFilter(category.isVisible, all))
        .orderBy(category.sortOrder);
    },
    { response: withReadErrors({ 200: 'CategoryList' }) },
  )

  // GET /categories/:id - Get one (public : 404 si invisible pour un anonyme).
  .get(
    '/:id',
    async ({ params, status, cookie, headers }) => {
      const all = await isPrivilegedRequest(
        cookie as Record<string, { value?: string }>,
        headers.authorization,
      );
      const [found] = await db
        .select()
        .from(category)
        .where(and(eq(category.id, params.id), visibilityFilter(category.isVisible, all)));
      if (!found) return status(404, notFound('Category'));
      return found;
    },
    {
      params: categoryParams,
      response: withNotFound({ 200: 'Category' }),
    },
  )

  // GET /categories/by-slug/:slug - Get one by slug (public : 404 si invisible).
  .get(
    '/by-slug/:slug',
    async ({ params, status, cookie, headers }) => {
      const all = await isPrivilegedRequest(
        cookie as Record<string, { value?: string }>,
        headers.authorization,
      );
      const [found] = await db
        .select()
        .from(category)
        .where(and(eq(category.slug, params.slug), visibilityFilter(category.isVisible, all)));
      if (!found) return status(404, notFound('Category'));
      return found;
    },
    {
      params: t.Object({ slug: t.String() }),
      response: withNotFound({ 200: 'Category' }),
    },
  )

  // GET /categories/:id/products - Get products in category with pagination (public)
  .get(
    '/:id/products',
    async ({ params, query, status, cookie, headers }) => {
      const all = await isPrivilegedRequest(
        cookie as Record<string, { value?: string }>,
        headers.authorization,
      );
      const [categoryExists] = await db
        .select({ id: category.id })
        .from(category)
        .where(and(eq(category.id, params.id), visibilityFilter(category.isVisible, all)));
      if (!categoryExists) return status(404, notFound('Category'));

      // Liste publique : produits PUBLIÉS de la catégorie. Recherche/filtres/tri/pagination
      // délégués à la projection unique des cartes (queryProductCards) ; l'appartenance catégorie
      // est injectée en condition supplémentaire.
      return queryProductCards(
        query,
        [eq(product.status, 'published')],
        [eq(product.category, params.id)],
      );
    },
    {
      params: categoryParams,
      query: productSubListQuery,
      response: withNotFound({ 200: 'ProductList' }),
    },
  )

  // === PROTECTED ROUTES (Admin) ===

  // POST /categories - Create (slug auto-generated)
  .use(permissionGuard('category', 'create'))
  .post(
    '/',
    async ({ body, currentUser, request }) => {
      const [created] = await db
        .insert(category)
        .values({
          name: body.name,
          slug: slugify(body.name),
          description: body.description,
          parent: body.parent,
          image: body.image,
          sortOrder: body.sortOrder ?? 0,
          isVisible: body.isVisible ?? true,
        })
        .returning();

      logAudit({
        userId: currentUser?.id,
        action: 'category.create',
        entityType: 'category',
        entityId: created.id,
        data: { name: created.name },
        ipAddress: getClientIp(request.headers),
      });

      return created;
    },
    {
      permission: true,
      body: categoryCreateBody,
      response: withAuthErrors({ 200: 'Category' }),
    },
  )

  // PUT /categories/:id - Update (slug immutable)
  .use(permissionGuard('category', 'update'))
  .put(
    '/:id',
    async ({ params, body, status, currentUser, request }) => {
      const [updated] = await db
        .update(category)
        .set({
          name: body.name,
          description: body.description,
          parent: body.parent,
          image: body.image,
          sortOrder: body.sortOrder,
          isVisible: body.isVisible,
        })
        .where(eq(category.id, params.id))
        .returning();
      if (!updated) return status(404, notFound('Category'));

      logAudit({
        userId: currentUser?.id,
        action: 'category.update',
        entityType: 'category',
        entityId: params.id,
        data: { name: updated.name },
        ipAddress: getClientIp(request.headers),
      });

      return updated;
    },
    {
      permission: true,
      params: categoryParams,
      body: categoryUpdateBody,
      response: withCrudErrors({ 200: 'Category' }),
    },
  )

  // PATCH /categories/batch/order - Batch update parent and sortOrder (drag & drop)
  .patch(
    '/batch/order',
    async ({ body }) => {
      await db.transaction(async (tx) => {
        for (const update of body) {
          await tx
            .update(category)
            .set({
              parent: update.parent,
              sortOrder: update.sortOrder,
            })
            .where(eq(category.id, update.id));
        }
      });
      return { success: true, count: body.length };
    },
    {
      permission: true,
      body: batchOrderBody,
      response: withAuthErrors({ 200: batchSuccessSchema }),
    },
  )

  // DELETE /categories/:id - Delete
  .use(permissionGuard('category', 'delete'))
  .delete(
    '/:id',
    async ({ params, status, currentUser, request }) => {
      const [deleted] = await db.delete(category).where(eq(category.id, params.id)).returning();
      if (!deleted) return status(404, notFound('Category'));

      logAudit({
        userId: currentUser?.id,
        action: 'category.delete',
        entityType: 'category',
        entityId: params.id,
        data: { name: deleted.name },
        ipAddress: getClientIp(request.headers),
      });

      return { success: true };
    },
    {
      permission: true,
      params: categoryParams,
      response: withCrudErrors({ 200: successSchema }),
    },
  );
