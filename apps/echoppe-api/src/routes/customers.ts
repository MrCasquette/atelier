import {
  address,
  and,
  count,
  customer,
  customerSession,
  db,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  order,
  sql,
  wishlistItem,
} from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { permissionGuard } from '../plugins/rbac';
import { buildListResponse, listResponse, parseListQuery } from '../utils/pagination';
import { successSchema, withCrudErrors } from '../utils/responses';

// Query schemas
const customerSearchQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
  search: t.Optional(t.String()),
  status: t.Optional(t.String()),
  dateFrom: t.Optional(t.String()),
  dateTo: t.Optional(t.String()),
  hasOrders: t.Optional(t.String()),
  sort: t.Optional(t.String()),
  order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
});

// Body schemas
const customerUpdateBody = t.Object({
  firstName: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  lastName: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  phone: t.Optional(t.Nullable(t.String({ maxLength: 20 }))),
  marketingOptin: t.Optional(t.Boolean()),
});

const statusBody = t.Object({
  isActive: t.Boolean(),
});

// Param schemas
const uuidParam = t.Object({
  id: t.String({ format: 'uuid' }),
});

// Response schemas

const customerListItemSchema = t.Object({
  id: t.String(),
  email: t.String(),
  firstName: t.String(),
  lastName: t.String(),
  phone: t.Nullable(t.String()),
  emailVerified: t.Boolean(),
  dateCreated: t.Date(),
  lastLogin: t.Nullable(t.Date()),
  orderCount: t.Number(),
});

const paginatedCustomersSchema = listResponse(customerListItemSchema);

const addressSchema = t.Object({
  id: t.String(),
  type: t.String(),
  label: t.Nullable(t.String()),
  firstName: t.String(),
  lastName: t.String(),
  company: t.Nullable(t.String()),
  street: t.String(),
  street2: t.Nullable(t.String()),
  postalCode: t.String(),
  city: t.String(),
  country: t.String(),
  phone: t.Nullable(t.String()),
  isDefault: t.Boolean(),
});

const orderSummarySchema = t.Object({
  id: t.String(),
  orderNumber: t.String(),
  status: t.String(),
  totalTtc: t.String(),
  dateCreated: t.Date(),
});

const customerDetailSchema = t.Object({
  id: t.String(),
  email: t.String(),
  firstName: t.String(),
  lastName: t.String(),
  phone: t.Nullable(t.String()),
  avatar: t.Nullable(t.String()),
  emailVerified: t.Boolean(),
  marketingOptin: t.Boolean(),
  dateCreated: t.Date(),
  dateUpdated: t.Date(),
  lastLogin: t.Nullable(t.Date()),
  addresses: t.Array(addressSchema),
  recentOrders: t.Array(orderSummarySchema),
  stats: t.Object({
    totalOrders: t.Number(),
    totalSpent: t.Number(),
  }),
});

export const customersRoutes = new Elysia({ prefix: '/customers', detail: { tags: ['Customers'] } })

  // === CUSTOMER READ ===
  .use(permissionGuard('customer', 'read'))

  // GET /customers - Liste paginée avec filtres
  .get(
    '/',
    async ({ query }) => {
      const { search, status, dateFrom, dateTo, hasOrders } = query;

      // Tri générique (défaut : plus récents d'abord). Filtres tous bespoke
      // (status -> emailVerified, hasOrders -> agrégat) → pas de `filterable`.
      const { page, limit, offset, orderBy } = parseListQuery(query, {
        sortable: {
          // `name` = colonne « Client » de l'UI (tri par nom de famille).
          name: customer.lastName,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          dateCreated: customer.dateCreated,
          lastLogin: customer.lastLogin,
        },
        defaultSort: desc(customer.dateCreated),
      });

      const conditions = [];

      // Search by email, firstName, lastName
      if (search) {
        const searchPattern = `%${search}%`;
        conditions.push(
          or(
            ilike(customer.email, searchPattern),
            ilike(customer.firstName, searchPattern),
            ilike(customer.lastName, searchPattern),
          ),
        );
      }

      // Filter by status (active = emailVerified)
      if (status === 'active') {
        conditions.push(eq(customer.emailVerified, true));
      } else if (status === 'inactive') {
        conditions.push(eq(customer.emailVerified, false));
      }

      // Filter by date range
      if (dateFrom) {
        const fromDate = new Date(`${dateFrom}T00:00:00`);
        conditions.push(gte(customer.dateCreated, fromDate));
      }
      if (dateTo) {
        const toDate = new Date(`${dateTo}T23:59:59.999`);
        conditions.push(lte(customer.dateCreated, toDate));
      }

      // Filter by hasOrders
      if (hasOrders !== undefined) {
        const customersWithOrders = await db
          .selectDistinct({ customerId: order.customer })
          .from(order);
        const customerIdsWithOrders = customersWithOrders.map((c) => c.customerId);

        if (hasOrders === 'true') {
          if (customerIdsWithOrders.length > 0) {
            conditions.push(sql`${customer.id} = ANY(${customerIdsWithOrders})`);
          } else {
            // No customers have orders
            conditions.push(sql`false`);
          }
        } else if (hasOrders === 'false') {
          if (customerIdsWithOrders.length > 0) {
            conditions.push(sql`${customer.id} != ALL(${customerIdsWithOrders})`);
          }
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get customers with order count
      const [customers, [{ total }]] = await Promise.all([
        db
          .select({
            id: customer.id,
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
            emailVerified: customer.emailVerified,
            dateCreated: customer.dateCreated,
            lastLogin: customer.lastLogin,
            orderCount: sql<number>`(
              SELECT COUNT(*) FROM "order" WHERE "order"."customer" = ${customer.id}
            )`,
          })
          .from(customer)
          .where(whereClause)
          .orderBy(...orderBy)
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count(customer.id) })
          .from(customer)
          .where(whereClause),
      ]);

      return buildListResponse(
        customers.map((c) => ({ ...c, orderCount: Number(c.orderCount) })),
        total,
        page,
        limit,
      );
    },
    {
      permission: true,
      query: customerSearchQuery,
      response: { 200: paginatedCustomersSchema },
    },
  )

  // GET /customers/:id - Détail client
  .get(
    '/:id',
    async ({ params, status }) => {
      const [customerData] = await db.select().from(customer).where(eq(customer.id, params.id));

      if (!customerData) {
        return status(404, { message: 'Client introuvable' });
      }

      // Get addresses with country name
      const addresses = await db
        .select({
          id: address.id,
          type: address.type,
          label: address.label,
          firstName: address.firstName,
          lastName: address.lastName,
          company: address.company,
          street: address.street,
          street2: address.street2,
          postalCode: address.postalCode,
          city: address.city,
          country: sql<string>`(SELECT name FROM country WHERE id = ${address.country})`,
          phone: address.phone,
          isDefault: address.isDefault,
        })
        .from(address)
        .where(eq(address.customer, params.id));

      // Get recent orders (last 10)
      const recentOrders = await db
        .select({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalTtc: order.totalTtc,
          dateCreated: order.dateCreated,
        })
        .from(order)
        .where(eq(order.customer, params.id))
        .orderBy(desc(order.dateCreated))
        .limit(10);

      // Get stats
      const [stats] = await db
        .select({
          totalOrders: count(order.id),
          totalSpent: sql<number>`COALESCE(SUM(${order.totalTtc}::numeric), 0)`,
        })
        .from(order)
        .where(eq(order.customer, params.id));

      return {
        id: customerData.id,
        email: customerData.email,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        phone: customerData.phone,
        avatar: customerData.avatar,
        emailVerified: customerData.emailVerified,
        marketingOptin: customerData.marketingOptin,
        dateCreated: customerData.dateCreated,
        dateUpdated: customerData.dateUpdated,
        lastLogin: customerData.lastLogin,
        addresses,
        recentOrders,
        stats: {
          totalOrders: Number(stats?.totalOrders ?? 0),
          totalSpent: Number(stats?.totalSpent ?? 0),
        },
      };
    },
    {
      permission: true,
      params: uuidParam,
      response: withCrudErrors({ 200: customerDetailSchema }),
    },
  )

  // === CUSTOMER UPDATE ===
  .use(permissionGuard('customer', 'update'))

  // PATCH /customers/:id - Modifier infos client
  .patch(
    '/:id',
    async ({ params, body, status }) => {
      const [existing] = await db
        .select({ id: customer.id })
        .from(customer)
        .where(eq(customer.id, params.id));

      if (!existing) {
        return status(404, { message: 'Client introuvable' });
      }

      const updates: Partial<typeof customer.$inferInsert> = {
        dateUpdated: new Date(),
      };

      if (body.firstName !== undefined) updates.firstName = body.firstName;
      if (body.lastName !== undefined) updates.lastName = body.lastName;
      if (body.phone !== undefined) updates.phone = body.phone;
      if (body.marketingOptin !== undefined) updates.marketingOptin = body.marketingOptin;

      await db.update(customer).set(updates).where(eq(customer.id, params.id));

      return { success: true };
    },
    {
      permission: true,
      params: uuidParam,
      body: customerUpdateBody,
      response: withCrudErrors({ 200: successSchema }),
    },
  )

  // PATCH /customers/:id/status - Activer/Désactiver
  .patch(
    '/:id/status',
    async ({ params, body, status }) => {
      const [existing] = await db
        .select({ id: customer.id })
        .from(customer)
        .where(eq(customer.id, params.id));

      if (!existing) {
        return status(404, { message: 'Client introuvable' });
      }

      await db
        .update(customer)
        .set({
          emailVerified: body.isActive,
          dateUpdated: new Date(),
        })
        .where(eq(customer.id, params.id));

      // If deactivating, invalidate all sessions
      if (!body.isActive) {
        await db.delete(customerSession).where(eq(customerSession.customer, params.id));
      }

      return { success: true };
    },
    {
      permission: true,
      params: uuidParam,
      body: statusBody,
      response: withCrudErrors({ 200: successSchema }),
    },
  )

  // === CUSTOMER DELETE (GDPR Anonymization) ===
  .use(permissionGuard('customer', 'delete'))

  // DELETE /customers/:id - Anonymiser client (RGPD)
  .delete(
    '/:id',
    async ({ params, status }) => {
      const [existing] = await db
        .select({ id: customer.id })
        .from(customer)
        .where(eq(customer.id, params.id));

      if (!existing) {
        return status(404, { message: 'Client introuvable' });
      }

      // Delete related data
      await db.delete(address).where(eq(address.customer, params.id));
      await db.delete(customerSession).where(eq(customerSession.customer, params.id));
      await db.delete(wishlistItem).where(eq(wishlistItem.customer, params.id));

      // Anonymize customer data (keep ID for order history)
      await db
        .update(customer)
        .set({
          email: `deleted-${params.id}@anonymized.local`,
          passwordHash: 'ANONYMIZED',
          firstName: 'Client',
          lastName: 'Anonymisé',
          phone: null,
          avatar: null,
          emailVerified: false,
          marketingOptin: false,
          dateUpdated: new Date(),
        })
        .where(eq(customer.id, params.id));

      return { success: true };
    },
    {
      permission: true,
      params: uuidParam,
      response: withCrudErrors({ 200: successSchema }),
    },
  );
