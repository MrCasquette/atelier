import { and, collection, count, db, eq, inArray, product, productCollection } from '@echoppe/core';
import { slugify } from '@echoppe/shared';
import { Elysia, t } from 'elysia';
import { getClientIp, logAudit } from '../lib/audit';
import { models } from '../models';
import { isPrivilegedRequest, permissionGuard } from '../plugins/rbac';
import { buildListResponse, getPaginationParams, paginationQuery } from '../utils/pagination';
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

// Schéma d'entité collection → src/models/collection.ts

const collectionCreateBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  description: t.Optional(t.String()),
  image: t.Optional(t.String({ format: 'uuid' })),
  isVisible: t.Optional(t.Boolean({ default: true })),
});

const collectionUpdateBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  description: t.Optional(t.String()),
  image: t.Optional(t.String({ format: 'uuid' })),
  isVisible: t.Optional(t.Boolean({ default: true })),
});

const collectionParams = t.Object({
  id: t.String({ format: 'uuid' }),
});

// (produits-liste : réutilise le modèle ProductList du catalog, plus de doublon ici)

export const collectionsRoutes = new Elysia({
  prefix: '/collections',
  detail: { tags: ['Collections'] },
})
  // Registre central des modèles nommés → components.schemas.
  .use(models)

  // === PUBLIC ROUTES ===

  // GET /collections - List (public visible-only ; admin/API voit tout).
  .get(
    '/',
    async ({ query, cookie, headers }) => {
      const { page, limit, offset } = getPaginationParams(query);
      const all = await isPrivilegedRequest(
        cookie as Record<string, { value?: string }>,
        headers.authorization,
      );
      const visible = visibilityFilter(collection.isVisible, all);

      const [collections, [{ total }]] = await Promise.all([
        db
          .select()
          .from(collection)
          .where(visible)
          .orderBy(collection.dateCreated)
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count(collection.id) })
          .from(collection)
          .where(visible),
      ]);

      return buildListResponse(collections, total, page, limit);
    },
    { query: paginationQuery, response: withReadErrors({ 200: 'CollectionList' }) },
  )

  // GET /collections/:id - Get one (public : 404 si invisible pour un anonyme).
  .get(
    '/:id',
    async ({ params, status, cookie, headers }) => {
      const all = await isPrivilegedRequest(
        cookie as Record<string, { value?: string }>,
        headers.authorization,
      );
      const [found] = await db
        .select()
        .from(collection)
        .where(and(eq(collection.id, params.id), visibilityFilter(collection.isVisible, all)));
      if (!found) return status(404, notFound('Collection'));
      return found;
    },
    {
      params: collectionParams,
      response: withNotFound({ 200: 'Collection' }),
    },
  )

  // GET /collections/by-slug/:slug - Get one by slug (public : 404 si invisible).
  .get(
    '/by-slug/:slug',
    async ({ params, status, cookie, headers }) => {
      const all = await isPrivilegedRequest(
        cookie as Record<string, { value?: string }>,
        headers.authorization,
      );
      const [found] = await db
        .select()
        .from(collection)
        .where(and(eq(collection.slug, params.slug), visibilityFilter(collection.isVisible, all)));
      if (!found) return status(404, notFound('Collection'));
      return found;
    },
    {
      params: t.Object({ slug: t.String() }),
      response: withNotFound({ 200: 'Collection' }),
    },
  )

  // GET /collections/:id/products - Get products in collection with pagination (public)
  .get(
    '/:id/products',
    async ({ params, query, status, cookie, headers }) => {
      const all = await isPrivilegedRequest(
        cookie as Record<string, { value?: string }>,
        headers.authorization,
      );
      const [collectionExists] = await db
        .select({ id: collection.id })
        .from(collection)
        .where(and(eq(collection.id, params.id), visibilityFilter(collection.isVisible, all)));
      if (!collectionExists) return status(404, notFound('Collection'));

      // Appartenance à la collection (jonction many-to-many).
      const productIds = await db
        .select({ productId: productCollection.product })
        .from(productCollection)
        .where(eq(productCollection.collection, params.id));
      const ids = productIds.map((p) => p.productId);

      if (ids.length === 0) {
        const { page, limit } = getPaginationParams(query);
        return buildListResponse([], 0, page, limit);
      }

      // Liste publique : produits PUBLIÉS de la collection. Recherche/filtres/tri/pagination
      // délégués à queryProductCards ; l'appartenance est injectée en condition supplémentaire.
      return queryProductCards(
        query,
        [eq(product.status, 'published')],
        [inArray(product.id, ids)],
      );
    },
    {
      params: collectionParams,
      query: productSubListQuery,
      response: withNotFound({ 200: 'ProductList' }),
    },
  )

  // === PROTECTED ROUTES (Admin) ===

  // POST /collections - Create (slug auto-generated)
  .use(permissionGuard('collection', 'create'))
  .post(
    '/',
    async ({ body, currentUser, request }) => {
      const [created] = await db
        .insert(collection)
        .values({
          name: body.name,
          slug: slugify(body.name),
          description: body.description,
          image: body.image,
          isVisible: body.isVisible ?? true,
        })
        .returning();

      logAudit({
        userId: currentUser?.id,
        action: 'collection.create',
        entityType: 'collection',
        entityId: created.id,
        data: { name: created.name },
        ipAddress: getClientIp(request.headers),
      });

      return created;
    },
    {
      permission: true,
      body: collectionCreateBody,
      response: withAuthErrors({ 200: 'Collection' }),
    },
  )

  // PUT /collections/:id - Update (slug immutable)
  .use(permissionGuard('collection', 'update'))
  .put(
    '/:id',
    async ({ params, body, status, currentUser, request }) => {
      const [updated] = await db
        .update(collection)
        .set({
          name: body.name,
          description: body.description,
          image: body.image,
          isVisible: body.isVisible,
        })
        .where(eq(collection.id, params.id))
        .returning();
      if (!updated) return status(404, notFound('Collection'));

      logAudit({
        userId: currentUser?.id,
        action: 'collection.update',
        entityType: 'collection',
        entityId: params.id,
        data: { name: updated.name },
        ipAddress: getClientIp(request.headers),
      });

      return updated;
    },
    {
      permission: true,
      params: collectionParams,
      body: collectionUpdateBody,
      response: withCrudErrors({ 200: 'Collection' }),
    },
  )

  // DELETE /collections/:id - Delete
  .use(permissionGuard('collection', 'delete'))
  .delete(
    '/:id',
    async ({ params, status, currentUser, request }) => {
      const [deleted] = await db.delete(collection).where(eq(collection.id, params.id)).returning();
      if (!deleted) return status(404, notFound('Collection'));

      logAudit({
        userId: currentUser?.id,
        action: 'collection.delete',
        entityType: 'collection',
        entityId: params.id,
        data: { name: deleted.name },
        ipAddress: getClientIp(request.headers),
      });

      return { success: true };
    },
    {
      permission: true,
      params: collectionParams,
      response: withCrudErrors({ 200: successSchema }),
    },
  );
