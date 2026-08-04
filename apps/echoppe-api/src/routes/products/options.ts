import {
  and,
  db,
  eq,
  ilike,
  option,
  optionValue,
  product,
  productOption,
  variant,
  variantOptionValue,
} from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { models } from '../../models';
import {
  colorMetadataSchema,
  optionSchema,
  optionTypeSchema,
  optionValueSchema,
} from '../../models/catalog';
import { permissionGuard } from '../../plugins/rbac';
import { conflictResponse, successSchema, withCrudErrors } from '../../utils/responses';

const optionParams = t.Object({
  id: t.String({ format: 'uuid' }),
  optionId: t.String({ format: 'uuid' }),
});

const optionValueParams = t.Object({
  id: t.String({ format: 'uuid' }),
  optionId: t.String({ format: 'uuid' }),
  valueId: t.String({ format: 'uuid' }),
});

const optionBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 50 }),
  type: t.Optional(optionTypeSchema),
  sortOrder: t.Optional(t.Number({ default: 0 })),
});

const optionValueBody = t.Object({
  value: t.String({ minLength: 1, maxLength: 100 }),
  // Couleur (type=color) ; ignorée/forcée à null pour une option de type string à la frontière.
  metadata: t.Optional(colorMetadataSchema),
  sortOrder: t.Optional(t.Number({ default: 0 })),
});

const optionUpdateBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
  type: t.Optional(optionTypeSchema),
  sortOrder: t.Optional(t.Number()),
});

const optionValueUpdateBody = t.Object({
  value: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  // `null` efface la couleur ; absent = inchangé ; forcée à null si l'option n'est pas color.
  metadata: t.Optional(t.Nullable(colorMetadataSchema)),
  sortOrder: t.Optional(t.Number()),
});

// Axes d'option (globaux) + leurs valeurs, associés aux produits. Guards option:read/create/
// update/delete (matrice RBAC identique à l'ancien fichier monolithique).
export const optionRoutes = new Elysia()
  .use(models)

  // GET /products/option-axes - Liste toutes les options globales
  .use(permissionGuard('option', 'read'))
  .get(
    '/option-axes',
    async () => {
      const options = await db.select().from(option).orderBy(option.name);
      return options;
    },
    { permission: true, response: { 200: t.Array(optionSchema) } },
  )

  // GET /products/:id/option-axes/:optionId/values - Valeurs (globales) d'une option
  .get(
    '/:id/option-axes/:optionId/values',
    async ({ params }) => {
      return db
        .select()
        .from(optionValue)
        .where(eq(optionValue.option, params.optionId))
        .orderBy(optionValue.sortOrder);
    },
    { permission: true, params: optionParams, response: { 200: t.Array(optionValueSchema) } },
  )

  // POST /products/:id/option-axes - Associe une option au produit (crée l'option si absente)
  .use(permissionGuard('option', 'create'))
  .post(
    '/:id/option-axes',
    async ({ params, body, status }) => {
      const [productExists] = await db.select().from(product).where(eq(product.id, params.id));
      if (!productExists) return status(404, { message: 'Product not found' });

      let opt = await db
        .select()
        .from(option)
        .where(ilike(option.name, body.name))
        .then((r) => r[0]);

      if (!opt) {
        [opt] = await db
          .insert(option)
          .values({ name: body.name, type: body.type ?? 'string' })
          .returning();
      }
      // Option existante : on respecte son `type` (pas de mutation silencieuse via ce POST).

      const [existing] = await db
        .select()
        .from(productOption)
        .where(and(eq(productOption.product, params.id), eq(productOption.option, opt.id)));

      if (existing) {
        return status(409, { message: 'Option already associated with this product' });
      }

      await db.insert(productOption).values({
        product: params.id,
        option: opt.id,
        sortOrder: body.sortOrder ?? 0,
      });

      return opt;
    },
    {
      permission: true,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      body: optionBody,
      response: withCrudErrors({ 200: 'Option', 409: conflictResponse }),
    },
  )

  // POST /products/:id/option-axes/:optionId/values
  .post(
    '/:id/option-axes/:optionId/values',
    async ({ params, body, status }) => {
      const [optionExists] = await db.select().from(option).where(eq(option.id, params.optionId));
      if (!optionExists) return status(404, { message: 'Option not found' });

      const [existing] = await db
        .select()
        .from(optionValue)
        .where(and(eq(optionValue.option, params.optionId), ilike(optionValue.value, body.value)));

      if (existing) {
        return existing; // Retourne la valeur existante au lieu d'erreur
      }

      // Frontière discriminée par le type PARENT : la couleur n'existe que pour type=color.
      const metadata = optionExists.type === 'color' ? (body.metadata ?? null) : null;

      const [created] = await db
        .insert(optionValue)
        .values({
          option: params.optionId,
          value: body.value,
          metadata,
          sortOrder: body.sortOrder ?? 0,
        })
        .returning();
      return created;
    },
    {
      permission: true,
      params: optionParams,
      body: optionValueBody,
      response: withCrudErrors({ 200: 'OptionValue' }),
    },
  )

  // PUT /products/:id/option-axes/:optionId - Édite une option (name/type/sortOrder)
  .use(permissionGuard('option', 'update'))
  .put(
    '/:id/option-axes/:optionId',
    async ({ params, body, status }) => {
      const [existing] = await db.select().from(option).where(eq(option.id, params.optionId));
      if (!existing) return status(404, { message: 'Option not found' });

      const nextType = body.type ?? existing.type;
      const [updated] = await db
        .update(option)
        .set({
          name: body.name ?? existing.name,
          type: nextType,
          sortOrder: body.sortOrder ?? existing.sortOrder,
        })
        .where(eq(option.id, params.optionId))
        .returning();

      // Passage color → string : une valeur texte ne porte pas de couleur → nettoyage metadata.
      if (existing.type === 'color' && nextType === 'string') {
        await db
          .update(optionValue)
          .set({ metadata: null })
          .where(eq(optionValue.option, params.optionId));
      }

      return updated;
    },
    {
      permission: true,
      params: optionParams,
      body: optionUpdateBody,
      response: withCrudErrors({ 200: 'Option' }),
    },
  )

  // PUT /products/:id/option-axes/:optionId/values/:valueId - Édite une valeur
  .put(
    '/:id/option-axes/:optionId/values/:valueId',
    async ({ params, body, status }) => {
      const [opt] = await db.select().from(option).where(eq(option.id, params.optionId));
      if (!opt) return status(404, { message: 'Option not found' });

      const [existing] = await db
        .select()
        .from(optionValue)
        .where(and(eq(optionValue.id, params.valueId), eq(optionValue.option, params.optionId)));
      if (!existing) return status(404, { message: 'Option value not found' });

      // Frontière discriminée par le type PARENT : couleur seulement pour type=color (null sinon).
      let metadata: (typeof existing)['metadata'] = null;
      if (opt.type === 'color') {
        metadata = body.metadata !== undefined ? body.metadata : existing.metadata;
      }

      const [updated] = await db
        .update(optionValue)
        .set({
          value: body.value ?? existing.value,
          metadata,
          sortOrder: body.sortOrder ?? existing.sortOrder,
        })
        .where(eq(optionValue.id, params.valueId))
        .returning();

      return updated;
    },
    {
      permission: true,
      params: optionValueParams,
      body: optionValueUpdateBody,
      response: withCrudErrors({ 200: 'OptionValue' }),
    },
  )

  // DELETE /products/:id/option-axes/:optionId/values/:valueId - Supprime une valeur (409 si utilisée)
  .use(permissionGuard('option', 'delete'))
  .delete(
    '/:id/option-axes/:optionId/values/:valueId',
    async ({ params, status }) => {
      const [existing] = await db
        .select()
        .from(optionValue)
        .where(and(eq(optionValue.id, params.valueId), eq(optionValue.option, params.optionId)));
      if (!existing) return status(404, { message: 'Option value not found' });

      // Refuse si des variantes portent encore cette valeur (ne réécrit jamais une variante).
      const [used] = await db
        .select({ v: variantOptionValue.variant })
        .from(variantOptionValue)
        .where(eq(variantOptionValue.optionValue, params.valueId))
        .limit(1);
      if (used) {
        return status(409, { message: 'Valeur utilisée par des variantes — détachez-la d’abord' });
      }

      await db.delete(optionValue).where(eq(optionValue.id, params.valueId));
      return { success: true };
    },
    {
      permission: true,
      params: optionValueParams,
      response: withCrudErrors({ 200: successSchema, 409: conflictResponse }),
    },
  )

  // DELETE /products/:id/option-axes/:optionId - Dissocie l'option DU PRODUIT (l'axe global reste).
  .delete(
    '/:id/option-axes/:optionId',
    async ({ params, status }) => {
      const [assoc] = await db
        .select()
        .from(productOption)
        .where(
          and(eq(productOption.product, params.id), eq(productOption.option, params.optionId)),
        );
      if (!assoc) return status(404, { message: 'Option non associée au produit' });

      const [used] = await db
        .select({ v: variantOptionValue.variant })
        .from(variantOptionValue)
        .innerJoin(variant, eq(variant.id, variantOptionValue.variant))
        .innerJoin(optionValue, eq(optionValue.id, variantOptionValue.optionValue))
        .where(and(eq(variant.product, params.id), eq(optionValue.option, params.optionId)))
        .limit(1);
      if (used) {
        return status(409, {
          message: 'Des variantes du produit utilisent cette option — détachez-les d’abord',
        });
      }

      await db
        .delete(productOption)
        .where(
          and(eq(productOption.product, params.id), eq(productOption.option, params.optionId)),
        );
      return { success: true };
    },
    {
      permission: true,
      params: optionParams,
      response: withCrudErrors({ 200: successSchema, 409: conflictResponse }),
    },
  );
