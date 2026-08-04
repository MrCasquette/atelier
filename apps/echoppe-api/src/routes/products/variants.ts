import { and, db, eq, ne, product, variant, variantOptionValue } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { models } from '../../models';
import { permissionGuard } from '../../plugins/rbac';
import { successSchema, withCrudErrors } from '../../utils/responses';
import { productParams } from './shared';

const variantParams = t.Object({
  id: t.String({ format: 'uuid' }),
  variantId: t.String({ format: 'uuid' }),
});

const variantBody = t.Object({
  sku: t.Optional(t.String({ maxLength: 50 })),
  barcode: t.Optional(t.String({ maxLength: 50 })),
  priceHt: t.Number({ minimum: 0 }),
  compareAtPriceHt: t.Optional(t.Number({ minimum: 0 })),
  costPrice: t.Optional(t.Number({ minimum: 0 })),
  weight: t.Optional(t.Number({ minimum: 0 })),
  length: t.Optional(t.Number({ minimum: 0 })),
  width: t.Optional(t.Number({ minimum: 0 })),
  height: t.Optional(t.Number({ minimum: 0 })),
  isDefault: t.Optional(t.Boolean({ default: false })),
  status: t.Optional(t.Union([t.Literal('draft'), t.Literal('published'), t.Literal('archived')])),
  sortOrder: t.Optional(t.Number({ default: 0 })),
  quantity: t.Optional(t.Number({ default: 0 })),
  lowStockThreshold: t.Optional(t.Number({ default: 5 })),
});

// Variantes d'un produit : CRUD + affectation des valeurs d'option. Une seule variante par défaut
// par produit (cocher isDefault décoche les autres, atomique).
export const variantRoutes = new Elysia()
  .use(models)

  // POST /products/:id/variants
  .use(permissionGuard('variant', 'create'))
  .post(
    '/:id/variants',
    async ({ params, body, status }) => {
      const [productExists] = await db.select().from(product).where(eq(product.id, params.id));
      if (!productExists) return status(404, { message: 'Product not found' });

      const created = await db.transaction(async (tx) => {
        if (body.isDefault) {
          await tx.update(variant).set({ isDefault: false }).where(eq(variant.product, params.id));
        }
        const [row] = await tx
          .insert(variant)
          .values({
            product: params.id,
            sku: body.sku,
            barcode: body.barcode,
            priceHt: String(body.priceHt),
            compareAtPriceHt: body.compareAtPriceHt ? String(body.compareAtPriceHt) : null,
            costPrice: body.costPrice ? String(body.costPrice) : null,
            weight: body.weight ? String(body.weight) : null,
            length: body.length ? String(body.length) : null,
            width: body.width ? String(body.width) : null,
            height: body.height ? String(body.height) : null,
            isDefault: body.isDefault ?? false,
            status: body.status ?? 'draft',
            sortOrder: body.sortOrder ?? 0,
            quantity: body.quantity ?? 0,
            lowStockThreshold: body.lowStockThreshold ?? 5,
          })
          .returning();
        return row;
      });
      return created;
    },
    {
      permission: true,
      params: productParams,
      body: variantBody,
      response: withCrudErrors({ 200: 'Variant' }),
    },
  )

  // PUT /products/:id/variants/:variantId
  .use(permissionGuard('variant', 'update'))
  .put(
    '/:id/variants/:variantId',
    async ({ params, body, status }) => {
      const updated = await db.transaction(async (tx) => {
        if (body.isDefault) {
          await tx
            .update(variant)
            .set({ isDefault: false })
            .where(and(eq(variant.product, params.id), ne(variant.id, params.variantId)));
        }
        const [row] = await tx
          .update(variant)
          .set({
            sku: body.sku,
            barcode: body.barcode,
            priceHt: String(body.priceHt),
            compareAtPriceHt: body.compareAtPriceHt ? String(body.compareAtPriceHt) : null,
            costPrice: body.costPrice ? String(body.costPrice) : null,
            weight: body.weight ? String(body.weight) : null,
            length: body.length ? String(body.length) : null,
            width: body.width ? String(body.width) : null,
            height: body.height ? String(body.height) : null,
            isDefault: body.isDefault ?? false,
            status: body.status ?? 'draft',
            sortOrder: body.sortOrder ?? 0,
            quantity: body.quantity ?? 0,
            lowStockThreshold: body.lowStockThreshold ?? 5,
          })
          .where(and(eq(variant.id, params.variantId), eq(variant.product, params.id)))
          .returning();
        return row;
      });
      if (!updated) return status(404, { message: 'Variant not found' });
      return updated;
    },
    {
      permission: true,
      params: variantParams,
      body: variantBody,
      response: withCrudErrors({ 200: 'Variant' }),
    },
  )

  // DELETE /products/:id/variants/:variantId
  .use(permissionGuard('variant', 'delete'))
  .delete(
    '/:id/variants/:variantId',
    async ({ params, status }) => {
      const [deleted] = await db
        .delete(variant)
        .where(and(eq(variant.id, params.variantId), eq(variant.product, params.id)))
        .returning();
      if (!deleted) return status(404, { message: 'Variant not found' });
      return { success: true };
    },
    { permission: true, params: variantParams, response: withCrudErrors({ 200: successSchema }) },
  )

  // PUT /products/:id/variants/:variantId/options - Set variant option values (replaces all)
  .use(permissionGuard('variant', 'update'))
  .put(
    '/:id/variants/:variantId/options',
    async ({ params, body, status }) => {
      const [variantExists] = await db
        .select()
        .from(variant)
        .where(and(eq(variant.id, params.variantId), eq(variant.product, params.id)));
      if (!variantExists) return status(404, { message: 'Variant not found' });

      await db.delete(variantOptionValue).where(eq(variantOptionValue.variant, params.variantId));

      if (body.optionValueIds.length > 0) {
        await db.insert(variantOptionValue).values(
          body.optionValueIds.map((optionValueId: string) => ({
            variant: params.variantId,
            optionValue: optionValueId,
          })),
        );
      }

      return { success: true };
    },
    {
      permission: true,
      params: variantParams,
      body: t.Object({ optionValueIds: t.Array(t.String({ format: 'uuid' })) }),
      response: withCrudErrors({ 200: successSchema }),
    },
  );
