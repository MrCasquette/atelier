import {
  and,
  db,
  desc,
  eq,
  order,
  orderItem,
  payment,
  shipment,
  shippingProvider,
  sql,
} from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { models } from '../models';
import {
  customerAuthPlugin,
  customerCookieSchema,
  type SessionCustomer,
} from '../plugins/customerAuth';
import { buildListResponse, getPaginationParams, paginationQuery } from '../utils/pagination';
import { withAuthErrors, withCrudErrors } from '../utils/responses';

// Espace commandes du client connecté (lecture seule). Chaque requête est filtrée sur
// `order.customer = currentCustomer.id` : un client ne voit QUE ses propres commandes.
// Projection storefront via les modèles nommés `Order` / `OrderList` (src/models/order.ts) :
// pas de `internalNote`, paiement et expédition allégés.

export const customerOrdersRoutes = new Elysia({
  prefix: '/customer/orders',
  detail: { tags: ['Customer Orders'] },
})
  .use(customerAuthPlugin)
  // Registre central des modèles nommés → components.schemas.
  .use(models)

  // GET /customer/orders - Liste paginée des commandes du client
  .get(
    '/',
    async ({ query, currentCustomer }) => {
      const customer = currentCustomer as SessionCustomer;
      const { page, limit, offset } = getPaginationParams(query);

      const [orders, countResult] = await Promise.all([
        db
          .select({
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            totalTtc: order.totalTtc,
            dateCreated: order.dateCreated,
          })
          .from(order)
          .where(eq(order.customer, customer.id))
          .orderBy(desc(order.dateCreated))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(order)
          .where(eq(order.customer, customer.id)),
      ]);

      const total = Number(countResult[0]?.count ?? 0);

      return buildListResponse(orders, total, page, limit);
    },
    {
      customerAuth: true,
      cookie: customerCookieSchema,
      query: paginationQuery,
      response: withAuthErrors({ 200: 'OrderList' }),
    },
  )

  // GET /customer/orders/:id - Détail d'une commande du client
  .get(
    '/:id',
    async ({ params, currentCustomer, status }) => {
      const customer = currentCustomer as SessionCustomer;

      const [orderData] = await db
        .select({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          shippingAddress: order.shippingAddress,
          billingAddress: order.billingAddress,
          subtotalHt: order.subtotalHt,
          shippingHt: order.shippingHt,
          discountHt: order.discountHt,
          totalHt: order.totalHt,
          totalTax: order.totalTax,
          totalTtc: order.totalTtc,
          customerNote: order.customerNote,
          dateCreated: order.dateCreated,
          dateUpdated: order.dateUpdated,
        })
        .from(order)
        .where(and(eq(order.id, params.id), eq(order.customer, customer.id)));

      if (!orderData) {
        return status(404, { message: 'Commande introuvable' });
      }

      const items = await db
        .select({
          id: orderItem.id,
          variant: orderItem.variant,
          label: orderItem.label,
          quantity: orderItem.quantity,
          unitPriceHt: orderItem.unitPriceHt,
          taxRate: orderItem.taxRate,
          totalHt: orderItem.totalHt,
          totalTtc: orderItem.totalTtc,
        })
        .from(orderItem)
        .where(eq(orderItem.order, params.id));

      const [paymentData] = await db
        .select({
          provider: payment.provider,
          status: payment.status,
          amount: payment.amount,
          dateCreated: payment.dateCreated,
        })
        .from(payment)
        .where(eq(payment.order, params.id));

      const [shipmentData] = await db
        .select({
          status: shipment.status,
          trackingNumber: shipment.trackingNumber,
          trackingUrl: shipment.trackingUrl,
          shippedAt: shipment.shippedAt,
          deliveredAt: shipment.deliveredAt,
          provider: {
            name: shippingProvider.name,
            type: shippingProvider.type,
          },
        })
        .from(shipment)
        .innerJoin(shippingProvider, eq(shipment.provider, shippingProvider.id))
        .where(eq(shipment.order, params.id));

      return {
        ...orderData,
        items,
        payment: paymentData ?? null,
        shipment: shipmentData ?? null,
      };
    },
    {
      customerAuth: true,
      cookie: customerCookieSchema,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: withCrudErrors({ 200: 'Order' }),
    },
  );
