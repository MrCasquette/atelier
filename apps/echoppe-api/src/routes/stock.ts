import { db, desc, eq, product, sql, stockMove, variant } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { permissionGuard } from '../plugins/rbac';
import {
  buildListResponse,
  getPaginationParams,
  listResponse,
  paginationQuery,
} from '../utils/pagination';
import { withCrudErrors } from '../utils/responses';

const stockMoveCreateBody = t.Object({
  variant: t.String({ format: 'uuid' }),
  quantity: t.Number(),
  type: t.Union([t.Literal('restock'), t.Literal('adjustment')]),
  note: t.Optional(t.String()),
});

const alertSchema = t.Object({
  variantId: t.String(),
  productId: t.String(),
  productName: t.String(),
  sku: t.Nullable(t.String()),
  quantity: t.Number(),
  lowStockThreshold: t.Nullable(t.Number()),
});

// Schemas
const stockMoveSchema = t.Object({
  id: t.String(),
  variant: t.Nullable(t.String()),
  label: t.String(),
  quantity: t.Number(),
  type: t.Union([
    t.Literal('sale'),
    t.Literal('return'),
    t.Literal('restock'),
    t.Literal('adjustment'),
    t.Literal('reservation'),
  ]),
  reference: t.Nullable(t.String()),
  note: t.Nullable(t.String()),
  dateCreated: t.Date(),
});
const stockVariantSchema = t.Object({
  id: t.String(),
  sku: t.Nullable(t.String()),
  productName: t.String(),
  quantity: t.Number(),
});
const paginatedStockSchema = listResponse(stockMoveSchema);

export const stockRoutes = new Elysia({ prefix: '/stock', detail: { tags: ['Stock'] } })

  // === STOCK READ ===
  .use(permissionGuard('stock', 'read'))

  // GET /stock - List stock moves with pagination
  .get(
    '/',
    async ({ query }) => {
      const { page, limit, offset } = getPaginationParams(query);

      const [moves, countResult] = await Promise.all([
        db
          .select()
          .from(stockMove)
          .orderBy(desc(stockMove.dateCreated))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(stockMove),
      ]);

      const total = Number(countResult[0]?.count ?? 0);

      return buildListResponse(moves, total, page, limit);
    },
    { permission: true, query: paginationQuery, response: { 200: paginatedStockSchema } },
  )

  // GET /stock/alerts - Variants below low stock threshold
  .get(
    '/alerts',
    async () => {
      const alerts = await db
        .select({
          variantId: variant.id,
          productId: product.id,
          productName: product.name,
          sku: variant.sku,
          quantity: variant.quantity,
          lowStockThreshold: variant.lowStockThreshold,
        })
        .from(variant)
        .innerJoin(product, eq(variant.product, product.id))
        .where(sql`${variant.quantity} <= COALESCE(${variant.lowStockThreshold}, 5)`)
        .orderBy(variant.quantity);

      return alerts;
    },
    { permission: true, response: t.Array(alertSchema) },
  )

  // GET /stock/variants - List variants for select (adjustment modal)
  .get(
    '/variants',
    async () => {
      const variants = await db
        .select({
          id: variant.id,
          sku: variant.sku,
          productName: product.name,
          quantity: variant.quantity,
        })
        .from(variant)
        .innerJoin(product, eq(variant.product, product.id))
        .orderBy(product.name, variant.sku);

      return variants;
    },
    { permission: true, response: { 200: t.Array(stockVariantSchema) } },
  )

  // === STOCK CREATE ===
  .use(permissionGuard('stock', 'create'))

  // POST /stock - Create a stock move and update variant quantity
  .post(
    '/',
    async ({ body, status }) => {
      // Get variant with product name for label
      const [v] = await db
        .select({
          id: variant.id,
          sku: variant.sku,
          quantity: variant.quantity,
          productName: product.name,
        })
        .from(variant)
        .innerJoin(product, eq(variant.product, product.id))
        .where(eq(variant.id, body.variant));

      if (!v) {
        return status(404, { message: 'Variant not found' });
      }

      // Build label
      const label = v.sku ? `${v.productName} — ${v.sku}` : v.productName;

      // Create move and update quantity in transaction
      const [move] = await db.transaction(async (tx) => {
        // Create stock move
        const [created] = await tx
          .insert(stockMove)
          .values({
            variant: body.variant,
            label,
            quantity: body.quantity,
            type: body.type,
            note: body.note,
          })
          .returning();

        // Update variant quantity
        await tx
          .update(variant)
          .set({
            quantity: sql`${variant.quantity} + ${body.quantity}`,
          })
          .where(eq(variant.id, body.variant));

        return [created];
      });

      return move;
    },
    {
      permission: true,
      body: stockMoveCreateBody,
      response: withCrudErrors({ 200: stockMoveSchema }),
    },
  );
