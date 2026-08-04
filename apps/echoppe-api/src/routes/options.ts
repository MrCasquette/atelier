import { and, asc, db, eq, ilike, option, optionValue, variantOptionValue } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { models } from '../models';
import {
  colorMetadataSchema,
  optionSchema,
  optionTypeSchema,
  optionValueSchema,
} from '../models/catalog';
import { permissionGuard } from '../plugins/rbac';
import { conflictResponse, successSchema, withCrudErrors } from '../utils/responses';

// Ressource GLOBALE de gestion des axes d'option (catalogue). Distincte des endpoints
// product-scoped (`/products/:id/options/...`) qui ne font que l'ASSOCIATION axe↔produit et
// l'assignation valeur↔variante. Ici on crée/édite/supprime les axes et leurs valeurs
// prédéfinies, hors contexte produit. Suppressions : 409 si utilisées par une variante
// (jamais de réécriture silencieuse).

const optionOnlyParams = t.Object({ optionId: t.String({ format: 'uuid' }) });
const valueParams = t.Object({
  optionId: t.String({ format: 'uuid' }),
  valueId: t.String({ format: 'uuid' }),
});

const axisCreateBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 50 }),
  type: t.Optional(optionTypeSchema),
  sortOrder: t.Optional(t.Number({ default: 0 })),
});

const axisUpdateBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
  type: t.Optional(optionTypeSchema),
  sortOrder: t.Optional(t.Number()),
});

const valueCreateBody = t.Object({
  value: t.String({ minLength: 1, maxLength: 100 }),
  metadata: t.Optional(colorMetadataSchema),
  sortOrder: t.Optional(t.Number({ default: 0 })),
});

const valueUpdateBody = t.Object({
  value: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  metadata: t.Optional(t.Nullable(colorMetadataSchema)),
  sortOrder: t.Optional(t.Number()),
});

// Prefix `/option-axes` (pas `/options`) : `options` est un verbe HTTP → Eden Treaty le réserve,
// la forme `api.options({id})` déclenche une requête OPTIONS au lieu de cibler la ressource.
export const optionsRoutes = new Elysia({ prefix: '/option-axes', detail: { tags: ['Options'] } })
  .use(models)

  // === LECTURE ===
  .use(permissionGuard('option', 'read'))

  // GET /options - Liste des axes (type, sortOrder)
  .get('/', async () => db.select().from(option).orderBy(asc(option.sortOrder), asc(option.name)), {
    permission: true,
    response: { 200: t.Array(optionSchema) },
  })

  // GET /options/:optionId/values - Valeurs prédéfinies d'un axe
  .get(
    '/:optionId/values',
    async ({ params, status }) => {
      const [opt] = await db.select().from(option).where(eq(option.id, params.optionId));
      if (!opt) return status(404, { message: 'Option not found' });
      return db
        .select()
        .from(optionValue)
        .where(eq(optionValue.option, params.optionId))
        .orderBy(asc(optionValue.sortOrder));
    },
    {
      permission: true,
      params: optionOnlyParams,
      response: withCrudErrors({ 200: t.Array(optionValueSchema) }),
    },
  )

  // === CRÉATION ===
  .use(permissionGuard('option', 'create'))

  // POST /options - Crée un axe (name unique ci)
  .post(
    '/',
    async ({ body, status }) => {
      const [dup] = await db.select().from(option).where(ilike(option.name, body.name));
      if (dup) return status(409, { message: 'Une option porte déjà ce nom' });

      const [created] = await db
        .insert(option)
        .values({ name: body.name, type: body.type ?? 'string', sortOrder: body.sortOrder ?? 0 })
        .returning();
      return created;
    },
    {
      permission: true,
      body: axisCreateBody,
      response: withCrudErrors({ 200: 'Option', 409: conflictResponse }),
    },
  )

  // POST /options/:optionId/values - Crée une valeur (metadata discriminée par le type parent)
  .post(
    '/:optionId/values',
    async ({ params, body, status }) => {
      const [opt] = await db.select().from(option).where(eq(option.id, params.optionId));
      if (!opt) return status(404, { message: 'Option not found' });

      const [existing] = await db
        .select()
        .from(optionValue)
        .where(and(eq(optionValue.option, params.optionId), ilike(optionValue.value, body.value)));
      if (existing) return existing;

      const metadata = opt.type === 'color' ? (body.metadata ?? null) : null;
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
      params: optionOnlyParams,
      body: valueCreateBody,
      response: withCrudErrors({ 200: 'OptionValue' }),
    },
  )

  // === MISE À JOUR ===
  .use(permissionGuard('option', 'update'))

  // PUT /options/:optionId - Édite un axe (+ re-normalise les valeurs si color → string)
  .put(
    '/:optionId',
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
      params: optionOnlyParams,
      body: axisUpdateBody,
      response: withCrudErrors({ 200: 'Option' }),
    },
  )

  // PUT /options/:optionId/values/:valueId - Édite une valeur
  .put(
    '/:optionId/values/:valueId',
    async ({ params, body, status }) => {
      const [opt] = await db.select().from(option).where(eq(option.id, params.optionId));
      if (!opt) return status(404, { message: 'Option not found' });

      const [existing] = await db
        .select()
        .from(optionValue)
        .where(and(eq(optionValue.id, params.valueId), eq(optionValue.option, params.optionId)));
      if (!existing) return status(404, { message: 'Option value not found' });

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
      params: valueParams,
      body: valueUpdateBody,
      response: withCrudErrors({ 200: 'OptionValue' }),
    },
  )

  // === SUPPRESSION ===
  .use(permissionGuard('option', 'delete'))

  // DELETE /options/:optionId/values/:valueId - 409 si une variante l'utilise
  .delete(
    '/:optionId/values/:valueId',
    async ({ params, status }) => {
      const [existing] = await db
        .select()
        .from(optionValue)
        .where(and(eq(optionValue.id, params.valueId), eq(optionValue.option, params.optionId)));
      if (!existing) return status(404, { message: 'Option value not found' });

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
      params: valueParams,
      response: withCrudErrors({ 200: successSchema, 409: conflictResponse }),
    },
  )

  // DELETE /options/:optionId - Supprime l'axe globalement (409 si une valeur est utilisée par
  // une variante). Sinon cascade : associations produit + valeurs prédéfinies.
  .delete(
    '/:optionId',
    async ({ params, status }) => {
      const [existing] = await db.select().from(option).where(eq(option.id, params.optionId));
      if (!existing) return status(404, { message: 'Option not found' });

      const [used] = await db
        .select({ v: variantOptionValue.variant })
        .from(variantOptionValue)
        .innerJoin(optionValue, eq(optionValue.id, variantOptionValue.optionValue))
        .where(eq(optionValue.option, params.optionId))
        .limit(1);
      if (used) {
        return status(409, {
          message: 'Des variantes utilisent cette option — détachez-les d’abord',
        });
      }

      await db.delete(option).where(eq(option.id, params.optionId));
      return { success: true };
    },
    {
      permission: true,
      params: optionOnlyParams,
      response: withCrudErrors({ 200: successSchema, 409: conflictResponse }),
    },
  );
