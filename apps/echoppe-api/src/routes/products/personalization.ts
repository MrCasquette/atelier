import { and, db, eq, personalizationField, product } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { models } from '../../models';
import { permissionGuard } from '../../plugins/rbac';
import { successSchema, withCrudErrors } from '../../utils/responses';
import { productParams } from './shared';

// Champs de personnalisation d'un produit (ADR-0010) — CRUD admin, guard product:update.
const personalizationFieldBody = t.Object({
  label: t.String({ minLength: 1, maxLength: 100 }),
  type: t.Optional(t.Union([t.Literal('text'), t.Literal('textarea')])),
  required: t.Optional(t.Boolean()),
  maxLength: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
  priceHt: t.Optional(t.Number({ minimum: 0 })),
  sortOrder: t.Optional(t.Number()),
});

const personalizationFieldParams = t.Object({
  id: t.String({ format: 'uuid' }),
  fieldId: t.String({ format: 'uuid' }),
});

export const personalizationRoutes = new Elysia()
  .use(models)
  .use(permissionGuard('product', 'update'))

  // POST /products/:id/personalization-fields
  .post(
    '/:id/personalization-fields',
    async ({ params, body, status }) => {
      const [productExists] = await db.select().from(product).where(eq(product.id, params.id));
      if (!productExists) return status(404, { message: 'Product not found' });

      const [created] = await db
        .insert(personalizationField)
        .values({
          product: params.id,
          label: body.label,
          type: body.type ?? 'text',
          required: body.required ?? false,
          maxLength: body.maxLength ?? null,
          priceHt: body.priceHt ? String(body.priceHt) : '0.00',
          sortOrder: body.sortOrder ?? 0,
        })
        .returning();
      return created;
    },
    {
      permission: true,
      params: productParams,
      body: personalizationFieldBody,
      response: withCrudErrors({ 200: 'PersonalizationField' }),
    },
  )

  // PUT /products/:id/personalization-fields/:fieldId
  .put(
    '/:id/personalization-fields/:fieldId',
    async ({ params, body, status }) => {
      const [updated] = await db
        .update(personalizationField)
        .set({
          label: body.label,
          type: body.type ?? 'text',
          required: body.required ?? false,
          maxLength: body.maxLength ?? null,
          priceHt: body.priceHt ? String(body.priceHt) : '0.00',
          sortOrder: body.sortOrder ?? 0,
        })
        .where(
          and(
            eq(personalizationField.id, params.fieldId),
            eq(personalizationField.product, params.id),
          ),
        )
        .returning();
      if (!updated) return status(404, { message: 'Personalization field not found' });
      return updated;
    },
    {
      permission: true,
      params: personalizationFieldParams,
      body: personalizationFieldBody,
      response: withCrudErrors({ 200: 'PersonalizationField' }),
    },
  )

  // DELETE /products/:id/personalization-fields/:fieldId
  .delete(
    '/:id/personalization-fields/:fieldId',
    async ({ params, status }) => {
      const [deleted] = await db
        .delete(personalizationField)
        .where(
          and(
            eq(personalizationField.id, params.fieldId),
            eq(personalizationField.product, params.id),
          ),
        )
        .returning();
      if (!deleted) return status(404, { message: 'Personalization field not found' });
      return { success: true };
    },
    {
      permission: true,
      params: personalizationFieldParams,
      response: withCrudErrors({ 200: successSchema }),
    },
  );
