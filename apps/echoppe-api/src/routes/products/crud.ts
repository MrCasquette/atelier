import {
  db,
  eq,
  option,
  optionValue,
  personalizationField,
  product,
  productOption,
  variant,
  variantOptionValue,
} from '@echoppe/core';
import { slugify } from '@echoppe/shared';
import { Elysia, t } from 'elysia';
import { getClientIp, logAudit } from '../../lib/audit';
import { models } from '../../models';
import { permissionGuard } from '../../plugins/rbac';
import { getRelatedProductIds, setRelatedProducts } from '../../utils/related';
import {
  successSchema,
  withAuthErrors,
  withCrudErrors,
  withNotFound,
  withReadErrors,
} from '../../utils/responses';
import { getProductTags, setProductTags } from '../../utils/tags';
import {
  buildEqFilters,
  productAdminSearchQuery,
  productParams,
  queryProductCards,
} from './shared';

const productCreateBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.String()),
  category: t.String({ format: 'uuid' }),
  taxRate: t.String({ format: 'uuid' }),
  status: t.Optional(t.Union([t.Literal('draft'), t.Literal('published'), t.Literal('archived')])),
  tags: t.Optional(t.Array(t.String({ maxLength: 50 }))),
  relatedProductIds: t.Optional(t.Array(t.String({ format: 'uuid' }))),
});

const productUpdateBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.String()),
  category: t.String({ format: 'uuid' }),
  taxRate: t.String({ format: 'uuid' }),
  status: t.Optional(t.Union([t.Literal('draft'), t.Literal('published'), t.Literal('archived')])),
  personalizationEnabled: t.Optional(t.Boolean()),
  // Tags (B3) — sémantique set : remplace l'ensemble des tags du produit (noms). Absent = inchangé.
  tags: t.Optional(t.Array(t.String({ maxLength: 50 }))),
  // Produits liés (B8) — set ordonné d'UUID. Absent = inchangé.
  relatedProductIds: t.Optional(t.Array(t.String({ format: 'uuid' }))),
});

const productPatchBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
  slug: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
  description: t.Optional(t.String()),
  category: t.Optional(t.String({ format: 'uuid' })),
  taxRate: t.Optional(t.String({ format: 'uuid' })),
  status: t.Optional(t.Union([t.Literal('draft'), t.Literal('published'), t.Literal('archived')])),
  personalizationEnabled: t.Optional(t.Boolean()),
  tags: t.Optional(t.Array(t.String({ maxLength: 50 }))),
  relatedProductIds: t.Optional(t.Array(t.String({ format: 'uuid' }))),
});

// Produit : CRUD (create/update/patch/delete) + lectures admin (liste tous statuts, fiche complète).
// Chaque groupe applique explicitement son guard RBAC.
export const productCrudRoutes = new Elysia()
  .use(models)

  // POST /products - Create
  .use(permissionGuard('product', 'create'))
  .post(
    '/',
    async ({ body, currentUser, request }) => {
      const [created] = await db
        .insert(product)
        .values({
          name: body.name,
          slug: slugify(body.name),
          description: body.description,
          category: body.category,
          taxRate: body.taxRate,
          status: body.status ?? 'draft',
        })
        .returning();

      // Tags (B3) : rattache l'ensemble fourni à la création.
      if (body.tags !== undefined) await setProductTags(created.id, body.tags);
      // Produits liés (B8) : set ordonné.
      if (body.relatedProductIds !== undefined)
        await setRelatedProducts(created.id, body.relatedProductIds);

      logAudit({
        userId: currentUser?.id,
        action: 'product.create',
        entityType: 'product',
        entityId: created.id,
        data: { name: created.name },
        ipAddress: getClientIp(request.headers),
      });

      return created;
    },
    { permission: true, body: productCreateBody, response: withAuthErrors({ 200: 'Product' }) },
  )

  // PUT /products/:id - Update (full, slug immutable)
  .use(permissionGuard('product', 'update'))
  .put(
    '/:id',
    async ({ params, body, status, currentUser, request }) => {
      const [updated] = await db
        .update(product)
        .set({
          name: body.name,
          description: body.description,
          category: body.category,
          taxRate: body.taxRate,
          status: body.status,
          personalizationEnabled: body.personalizationEnabled,
          dateUpdated: new Date(),
        })
        .where(eq(product.id, params.id))
        .returning();
      if (!updated) return status(404, { message: 'Product not found' });

      // Tags (B3) : remplace l'ensemble si fourni (absent = inchangé).
      if (body.tags !== undefined) await setProductTags(params.id, body.tags);
      if (body.relatedProductIds !== undefined)
        await setRelatedProducts(params.id, body.relatedProductIds);

      logAudit({
        userId: currentUser?.id,
        action: 'product.update',
        entityType: 'product',
        entityId: params.id,
        data: { name: updated.name },
        ipAddress: getClientIp(request.headers),
      });

      return updated;
    },
    {
      permission: true,
      params: productParams,
      body: productUpdateBody,
      response: withCrudErrors({ 200: 'Product' }),
    },
  )

  // PATCH /products/:id - Partial update
  .patch(
    '/:id',
    async ({ params, body, status }) => {
      const updateData: Record<string, unknown> = { dateUpdated: new Date() };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.slug !== undefined) updateData.slug = body.slug;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.category !== undefined) updateData.category = body.category;
      if (body.taxRate !== undefined) updateData.taxRate = body.taxRate;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.personalizationEnabled !== undefined)
        updateData.personalizationEnabled = body.personalizationEnabled;

      const [updated] = await db
        .update(product)
        .set(updateData)
        .where(eq(product.id, params.id))
        .returning();

      if (!updated) return status(404, { message: 'Product not found' });

      // Tags (B3) : remplace l'ensemble si fourni (absent = inchangé).
      if (body.tags !== undefined) await setProductTags(params.id, body.tags);
      if (body.relatedProductIds !== undefined)
        await setRelatedProducts(params.id, body.relatedProductIds);

      return updated;
    },
    {
      permission: true,
      params: productParams,
      body: productPatchBody,
      response: withCrudErrors({ 200: 'Product' }),
    },
  )

  // DELETE /products/:id - Delete
  .use(permissionGuard('product', 'delete'))
  .delete(
    '/:id',
    async ({ params, status, currentUser, request }) => {
      const [deleted] = await db.delete(product).where(eq(product.id, params.id)).returning();
      if (!deleted) return status(404, { message: 'Product not found' });

      logAudit({
        userId: currentUser?.id,
        action: 'product.delete',
        entityType: 'product',
        entityId: params.id,
        data: { name: deleted.name },
        ipAddress: getClientIp(request.headers),
      });

      return { success: true };
    },
    { permission: true, params: productParams, response: withCrudErrors({ 200: successSchema }) },
  )

  // === LECTURE ADMIN ===
  // adminOnly : le rôle Public a `product:read` (storefront) → sans ça, ces lectures
  // (brouillons, champs internes du variant) seraient accessibles à un anonyme.
  .use(permissionGuard('product', 'read', { adminOnly: true }))

  // GET /products/admin - Liste admin : TOUS les statuts + filtre `status` optionnel.
  .get(
    '/admin',
    async ({ query }) =>
      queryProductCards(query, buildEqFilters(query, { status: product.status })),
    {
      permission: true,
      query: productAdminSearchQuery,
      response: withReadErrors({ 200: 'ProductList' }),
    },
  )

  // GET /products/:id/full - Produit + variants COMPLETS + options + personnalisation (ADMIN).
  .get(
    '/:id/full',
    async ({ params, status }) => {
      const [found] = await db.select().from(product).where(eq(product.id, params.id));
      if (!found) return status(404, { message: 'Product not found' });

      const variants = await db
        .select()
        .from(variant)
        .where(eq(variant.product, params.id))
        .orderBy(variant.sortOrder);

      const productOptions = await db
        .select({ option: option, sortOrder: productOption.sortOrder })
        .from(productOption)
        .innerJoin(option, eq(productOption.option, option.id))
        .where(eq(productOption.product, params.id))
        .orderBy(productOption.sortOrder);

      const optionsWithValues = await Promise.all(
        productOptions.map(async (po) => {
          const values = await db
            .select()
            .from(optionValue)
            .where(eq(optionValue.option, po.option.id))
            .orderBy(optionValue.sortOrder);
          return { ...po.option, sortOrder: po.sortOrder, values };
        }),
      );

      const variantsWithOptions = await Promise.all(
        variants.map(async (v) => {
          const optionValues = await db
            .select()
            .from(variantOptionValue)
            .where(eq(variantOptionValue.variant, v.id));
          return { ...v, optionValues: optionValues.map((ov) => ov.optionValue) };
        }),
      );

      const personalizationFields = await db
        .select()
        .from(personalizationField)
        .where(eq(personalizationField.product, params.id))
        .orderBy(personalizationField.sortOrder);

      const tags = await getProductTags(params.id);
      const relatedProductIds = await getRelatedProductIds(params.id);

      return {
        ...found,
        variants: variantsWithOptions,
        options: optionsWithValues,
        tags,
        relatedProductIds,
        personalizationEnabled: found.personalizationEnabled,
        personalizationFields,
      };
    },
    {
      permission: true,
      params: productParams,
      response: withNotFound({ 200: 'ProductAdminWithVariants' }),
    },
  );
