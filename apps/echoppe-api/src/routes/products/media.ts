import { and, db, eq, product, productMedia } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { models } from '../../models';
import { productMediaSchema } from '../../models/catalog';
import { permissionGuard } from '../../plugins/rbac';
import { successSchema, withCrudErrors } from '../../utils/responses';
import { productParams } from './shared';

const mediaParams = t.Object({
  id: t.String({ format: 'uuid' }),
  mediaId: t.String({ format: 'uuid' }),
});

const productMediaBody = t.Object({
  mediaId: t.String({ format: 'uuid' }),
  sortOrder: t.Optional(t.Number({ default: 0 })),
  isFeatured: t.Optional(t.Boolean({ default: false })),
  featuredForVariant: t.Optional(t.String({ format: 'uuid' })),
});

const productMediaUpdateBody = t.Object({
  sortOrder: t.Optional(t.Number()),
  isFeatured: t.Optional(t.Boolean()),
  featuredForVariant: t.Optional(t.Union([t.String({ format: 'uuid' }), t.Null()])),
});

// Galerie média d'un produit. Lecture + POST/PUT sous `product:update`, suppression sous
// `product:delete` (matrice RBAC identique à l'ancien fichier monolithique).
export const mediaRoutes = new Elysia()
  .use(models)
  .use(permissionGuard('product', 'update'))

  // GET /products/:id/media
  .get(
    '/:id/media',
    async ({ params }) => {
      const media = await db
        .select()
        .from(productMedia)
        .where(eq(productMedia.product, params.id))
        .orderBy(productMedia.sortOrder);
      return media;
    },
    { permission: true, params: productParams, response: t.Array(productMediaSchema) },
  )

  // POST /products/:id/media - Add media to product
  .post(
    '/:id/media',
    async ({ params, body, status }) => {
      const [productExists] = await db.select().from(product).where(eq(product.id, params.id));
      if (!productExists) return status(404, { message: 'Product not found' });

      if (body.isFeatured) {
        await db
          .update(productMedia)
          .set({ isFeatured: false })
          .where(and(eq(productMedia.product, params.id), eq(productMedia.isFeatured, true)));
      }

      const [created] = await db
        .insert(productMedia)
        .values({
          product: params.id,
          media: body.mediaId,
          sortOrder: body.sortOrder ?? 0,
          isFeatured: body.isFeatured ?? false,
          featuredForVariant: body.featuredForVariant ?? null,
        })
        .returning();
      return created;
    },
    {
      permission: true,
      params: productParams,
      body: productMediaBody,
      response: withCrudErrors({ 200: 'ProductMedia' }),
    },
  )

  // PUT /products/:id/media/:mediaId - Update media settings
  .put(
    '/:id/media/:mediaId',
    async ({ params, body, status }) => {
      if (body.isFeatured) {
        await db
          .update(productMedia)
          .set({ isFeatured: false })
          .where(and(eq(productMedia.product, params.id), eq(productMedia.isFeatured, true)));
      }

      if (body.featuredForVariant) {
        await db
          .update(productMedia)
          .set({ featuredForVariant: null })
          .where(eq(productMedia.featuredForVariant, body.featuredForVariant));
      }

      const [updated] = await db
        .update(productMedia)
        .set({
          sortOrder: body.sortOrder,
          isFeatured: body.isFeatured,
          featuredForVariant: body.featuredForVariant,
        })
        .where(and(eq(productMedia.product, params.id), eq(productMedia.media, params.mediaId)))
        .returning();

      if (!updated) return status(404, { message: 'Product media not found' });
      return updated;
    },
    {
      permission: true,
      params: mediaParams,
      body: productMediaUpdateBody,
      response: withCrudErrors({ 200: 'ProductMedia' }),
    },
  )

  // DELETE /products/:id/media/:mediaId
  .use(permissionGuard('product', 'delete'))
  .delete(
    '/:id/media/:mediaId',
    async ({ params, status }) => {
      const [deleted] = await db
        .delete(productMedia)
        .where(and(eq(productMedia.product, params.id), eq(productMedia.media, params.mediaId)))
        .returning();
      if (!deleted) return status(404, { message: 'Product media not found' });
      return { success: true };
    },
    { permission: true, params: mediaParams, response: withCrudErrors({ 200: successSchema }) },
  );
