import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  and,
  customer,
  db,
  desc,
  eq,
  folder,
  generateInvoice,
  getInvoicesByOrder,
  gte,
  invoice,
  like,
  lte,
  media,
  or,
  order,
  orderItem,
  payment,
  regenerateInvoicePdf,
  sendShipmentNotification,
  shipment,
  shippingProvider,
  sql,
  stockMove,
  variant,
} from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { UPLOAD_DIR } from '../lib/config';
import { permissionGuard } from '../plugins/rbac';
import { buildListResponse, listResponse, parseListQuery } from '../utils/pagination';
import { successSchema, withCrudErrors } from '../utils/responses';

const ordersQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
  status: t.Optional(t.String()),
  dateFrom: t.Optional(t.String()),
  dateTo: t.Optional(t.String()),
  search: t.Optional(t.String()),
  amountMin: t.Optional(t.Numeric()),
  amountMax: t.Optional(t.Numeric()),
  sort: t.Optional(t.String()),
  order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
});

const statusBody = t.Object({
  status: t.Union([
    t.Literal('pending'),
    t.Literal('confirmed'),
    t.Literal('processing'),
    t.Literal('shipped'),
    t.Literal('delivered'),
    t.Literal('cancelled'),
    t.Literal('refunded'),
  ]),
});

const notesBody = t.Object({
  internalNote: t.Optional(t.String()),
  customerNote: t.Optional(t.String()),
});

const uuidParam = t.Object({
  id: t.String({ format: 'uuid' }),
});

// Response schemas

const orderStatusEnum = t.Union([
  t.Literal('pending'),
  t.Literal('confirmed'),
  t.Literal('processing'),
  t.Literal('shipped'),
  t.Literal('delivered'),
  t.Literal('cancelled'),
  t.Literal('refunded'),
]);

const customerSummarySchema = t.Object({
  id: t.String(),
  email: t.String(),
  firstName: t.String(),
  lastName: t.String(),
});

const orderListItemSchema = t.Object({
  id: t.String(),
  orderNumber: t.String(),
  status: orderStatusEnum,
  totalTtc: t.String(),
  dateCreated: t.Date(),
  customer: customerSummarySchema,
});

const paginatedOrdersSchema = listResponse(orderListItemSchema);

const customerDetailSchema = t.Object({
  id: t.String(),
  email: t.String(),
  firstName: t.String(),
  lastName: t.String(),
  phone: t.Nullable(t.String()),
});

const orderItemSchema = t.Object({
  id: t.String(),
  order: t.String(),
  variant: t.Nullable(t.String()),
  label: t.String(),
  quantity: t.Number(),
  unitPriceHt: t.String(),
  taxRate: t.String(),
  totalHt: t.String(),
  totalTtc: t.String(),
});

const paymentSchema = t.Object({
  id: t.String(),
  order: t.String(),
  provider: t.String(),
  status: t.String(),
  amount: t.String(),
  providerTransactionId: t.Nullable(t.String()),
  dateCreated: t.Date(),
  dateUpdated: t.Nullable(t.Date()),
});

const shipmentProviderSchema = t.Object({
  id: t.String(),
  name: t.String(),
  type: t.String(),
});

const shipmentSchema = t.Object({
  id: t.String(),
  status: t.String(),
  trackingNumber: t.Nullable(t.String()),
  trackingUrl: t.Nullable(t.String()),
  weight: t.Nullable(t.String()),
  shippedAt: t.Nullable(t.Date()),
  deliveredAt: t.Nullable(t.Date()),
  dateCreated: t.Date(),
  provider: t.Nullable(shipmentProviderSchema),
});

const orderDetailSchema = t.Object({
  id: t.String(),
  orderNumber: t.String(),
  status: orderStatusEnum,
  shippingAddress: t.Any(),
  billingAddress: t.Any(),
  subtotalHt: t.String(),
  shippingHt: t.String(),
  discountHt: t.String(),
  totalHt: t.String(),
  totalTax: t.String(),
  totalTtc: t.String(),
  customerNote: t.Nullable(t.String()),
  internalNote: t.Nullable(t.String()),
  dateCreated: t.Date(),
  dateUpdated: t.Nullable(t.Date()),
  customer: customerDetailSchema,
  items: t.Array(orderItemSchema),
  payment: t.Nullable(paymentSchema),
  shipment: t.Nullable(shipmentSchema),
});

const statusChangeResultSchema = t.Object({
  success: t.Boolean(),
  previousStatus: orderStatusEnum,
  newStatus: orderStatusEnum,
});

const statusByStatusSchema = t.Record(
  t.String(),
  t.Object({ count: t.Number(), total: t.Number() }),
);

const orderStatsSchema = t.Object({
  byStatus: statusByStatusSchema,
  totalOrders: t.Number(),
  totalRevenue: t.Number(),
});

const invoiceSummarySchema = t.Object({
  id: t.String(),
  type: t.String(),
  number: t.String(),
  status: t.String(),
  totalHt: t.String(),
  totalTax: t.String(),
  totalTtc: t.String(),
  dateIssued: t.Date(),
  dateDue: t.Nullable(t.Date()),
  hasPdf: t.Boolean(),
});

const invoiceCreatedSchema = t.Object({
  id: t.String(),
  number: t.String(),
  pdfUrl: t.String(),
});

export const ordersRoutes = new Elysia({ prefix: '/orders', detail: { tags: ['Orders'] } })

  // === ORDER READ ===
  .use(permissionGuard('order', 'read'))

  // GET /orders - Liste paginée avec filtres
  .get(
    '/',
    async ({ query }) => {
      const { page, limit, offset, orderBy, filters } = parseListQuery(query, {
        sortable: {
          orderNumber: order.orderNumber,
          status: order.status,
          totalTtc: order.totalTtc,
          dateCreated: order.dateCreated,
        },
        defaultSort: desc(order.dateCreated),
        filterable: { status: order.status },
      });

      // Filtres génériques (status) + bespoke : ranges de date/montant + recherche cross-table.
      const conditions = [...filters];
      if (query.dateFrom) {
        conditions.push(gte(order.dateCreated, new Date(`${query.dateFrom}T00:00:00`)));
      }
      if (query.dateTo) {
        conditions.push(lte(order.dateCreated, new Date(`${query.dateTo}T23:59:59.999`)));
      }
      if (query.amountMin !== undefined) {
        conditions.push(gte(order.totalTtc, query.amountMin.toString()));
      }
      if (query.amountMax !== undefined) {
        conditions.push(lte(order.totalTtc, query.amountMax.toString()));
      }
      if (query.search) {
        const search = `%${query.search}%`;
        const searchCondition = or(
          like(order.orderNumber, search),
          like(customer.email, search),
          like(customer.firstName, search),
          like(customer.lastName, search),
        );
        if (searchCondition) conditions.push(searchCondition);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [orders, countResult] = await Promise.all([
        db
          .select({
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            totalTtc: order.totalTtc,
            dateCreated: order.dateCreated,
            customer: {
              id: customer.id,
              email: customer.email,
              firstName: customer.firstName,
              lastName: customer.lastName,
            },
          })
          .from(order)
          .innerJoin(customer, eq(order.customer, customer.id))
          .where(whereClause)
          .orderBy(...orderBy)
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(order)
          .innerJoin(customer, eq(order.customer, customer.id))
          .where(whereClause),
      ]);

      const total = Number(countResult[0]?.count ?? 0);

      return buildListResponse(orders, total, page, limit);
    },
    { permission: true, query: ordersQuery, response: { 200: paginatedOrdersSchema } },
  )

  // GET /orders/:id - Détail commande
  .get(
    '/:id',
    async ({ params, status }) => {
      // Get order with customer
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
          internalNote: order.internalNote,
          dateCreated: order.dateCreated,
          dateUpdated: order.dateUpdated,
          customer: {
            id: customer.id,
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
          },
        })
        .from(order)
        .innerJoin(customer, eq(order.customer, customer.id))
        .where(eq(order.id, params.id));

      if (!orderData) {
        return status(404, { message: 'Commande introuvable' });
      }

      // Get order items
      const items = await db.select().from(orderItem).where(eq(orderItem.order, params.id));

      // Get payment (if exists)
      const [paymentData] = await db.select().from(payment).where(eq(payment.order, params.id));

      // Get shipment (if exists)
      const [shipmentData] = await db
        .select({
          id: shipment.id,
          status: shipment.status,
          trackingNumber: shipment.trackingNumber,
          trackingUrl: shipment.trackingUrl,
          weight: shipment.weight,
          shippedAt: shipment.shippedAt,
          deliveredAt: shipment.deliveredAt,
          dateCreated: shipment.dateCreated,
          provider: {
            id: shippingProvider.id,
            name: shippingProvider.name,
            type: shippingProvider.type,
          },
        })
        .from(shipment)
        .leftJoin(shippingProvider, eq(shipment.provider, shippingProvider.id))
        .where(eq(shipment.order, params.id));

      return {
        ...orderData,
        items,
        payment: paymentData ?? null,
        shipment: shipmentData ?? null,
      };
    },
    { permission: true, params: uuidParam, response: withCrudErrors({ 200: orderDetailSchema }) },
  )

  // === ORDER UPDATE ===
  .use(permissionGuard('order', 'update'))

  // PATCH /orders/:id/status - Changer statut
  .patch(
    '/:id/status',
    async ({ params, body, status }) => {
      const [existing] = await db
        .select({ id: order.id, status: order.status })
        .from(order)
        .where(eq(order.id, params.id));

      if (!existing) {
        return status(404, { message: 'Commande introuvable' });
      }

      const previousStatus = existing.status;
      const newStatus = body.status;

      // Update status
      await db
        .update(order)
        .set({ status: newStatus, dateUpdated: new Date() })
        .where(eq(order.id, params.id));

      // Handle stock decrement when confirmed
      if (previousStatus === 'pending' && newStatus === 'confirmed') {
        await decrementStock(params.id);
      }

      // Handle stock increment when cancelled (if was confirmed+)
      if (
        newStatus === 'cancelled' &&
        ['confirmed', 'processing', 'shipped'].includes(previousStatus)
      ) {
        await incrementStock(params.id);
      }

      // Handle stock increment when refunded (return from customer)
      if (newStatus === 'refunded' && previousStatus === 'delivered') {
        await incrementStock(params.id, 'Commande remboursée');
      }

      // Send shipment notification email when shipped
      if (newStatus === 'shipped' && previousStatus !== 'shipped') {
        const [orderData] = await db
          .select({
            orderNumber: order.orderNumber,
            customerId: order.customer,
          })
          .from(order)
          .where(eq(order.id, params.id));

        if (orderData) {
          const [customerData] = await db
            .select({ email: customer.email, firstName: customer.firstName })
            .from(customer)
            .where(eq(customer.id, orderData.customerId));

          const [shipmentData] = await db
            .select({ trackingNumber: shipment.trackingNumber, trackingUrl: shipment.trackingUrl })
            .from(shipment)
            .where(eq(shipment.order, params.id));

          if (customerData) {
            await sendShipmentNotification({
              customerEmail: customerData.email,
              customerName: customerData.firstName ?? undefined,
              orderNumber: orderData.orderNumber,
              trackingNumber: shipmentData?.trackingNumber ?? undefined,
              trackingUrl: shipmentData?.trackingUrl ?? undefined,
            });
          }
        }
      }

      return { success: true, previousStatus, newStatus };
    },
    {
      permission: true,
      params: uuidParam,
      body: statusBody,
      response: withCrudErrors({ 200: statusChangeResultSchema }),
    },
  )

  // PATCH /orders/:id/notes - Modifier notes
  .patch(
    '/:id/notes',
    async ({ params, body, status }) => {
      const [existing] = await db
        .select({ id: order.id })
        .from(order)
        .where(eq(order.id, params.id));

      if (!existing) {
        return status(404, { message: 'Commande introuvable' });
      }

      const updates: Partial<typeof order.$inferInsert> = {
        dateUpdated: new Date(),
      };

      if (body.internalNote !== undefined) {
        updates.internalNote = body.internalNote;
      }
      if (body.customerNote !== undefined) {
        updates.customerNote = body.customerNote;
      }

      await db.update(order).set(updates).where(eq(order.id, params.id));

      return { success: true };
    },
    {
      permission: true,
      params: uuidParam,
      body: notesBody,
      response: withCrudErrors({ 200: successSchema }),
    },
  )

  // === ORDER READ (stats) ===
  .use(permissionGuard('order', 'read'))

  // GET /orders/stats - Statistiques commandes
  .get(
    '/stats',
    async () => {
      const stats = await db
        .select({
          status: order.status,
          count: sql<number>`count(*)`,
          total: sql<number>`sum(${order.totalTtc}::numeric)`,
        })
        .from(order)
        .groupBy(order.status);

      const byStatus = Object.fromEntries(
        stats.map((s) => [s.status, { count: Number(s.count), total: Number(s.total) || 0 }]),
      );

      const totalOrders = stats.reduce((acc, s) => acc + Number(s.count), 0);
      const totalRevenue = stats
        .filter((s) => !['cancelled', 'refunded'].includes(s.status))
        .reduce((acc, s) => acc + (Number(s.total) || 0), 0);

      return {
        byStatus,
        totalOrders,
        totalRevenue,
      };
    },
    { permission: true, response: { 200: orderStatsSchema } },
  )

  // === INVOICES (READ) ===

  // GET /orders/:id/invoices - Liste des factures d'une commande
  .get(
    '/:id/invoices',
    async ({ params, status }) => {
      const [existing] = await db
        .select({ id: order.id })
        .from(order)
        .where(eq(order.id, params.id));

      if (!existing) {
        return status(404, { message: 'Commande introuvable' });
      }

      const invoices = await getInvoicesByOrder(params.id);

      return invoices.map((inv) => ({
        id: inv.id,
        type: inv.type,
        number: inv.number,
        status: inv.status,
        totalHt: inv.totalHt,
        totalTax: inv.totalTax,
        totalTtc: inv.totalTtc,
        dateIssued: inv.dateIssued,
        dateDue: inv.dateDue,
        hasPdf: !!inv.pdf,
      }));
    },
    {
      permission: true,
      params: uuidParam,
      response: withCrudErrors({ 200: t.Array(invoiceSummarySchema) }),
    },
  )

  // === INVOICES (CREATE) ===
  .use(permissionGuard('order', 'update'))

  // POST /orders/:id/invoice - Générer une facture
  .post(
    '/:id/invoice',
    async ({ params, body, status }) => {
      // Vérifier que la commande existe
      const [existing] = await db
        .select({ id: order.id, orderNumber: order.orderNumber })
        .from(order)
        .where(eq(order.id, params.id));

      if (!existing) {
        return status(404, { message: 'Commande introuvable' });
      }

      // Générer la facture
      const result = await generateInvoice(params.id, {
        type: body?.type ?? 'invoice',
        dateDue: body?.dateDue ? new Date(body.dateDue) : undefined,
      });

      // Sauvegarder le PDF dans le dossier uploads
      const filenameDisk = `${randomUUID()}.pdf`;
      const filePath = join(UPLOAD_DIR, filenameDisk);
      await Bun.write(filePath, result.pdfBuffer);

      // Trouver ou créer le dossier "Factures"
      let [invoicesFolder] = await db
        .select({ id: folder.id })
        .from(folder)
        .where(eq(folder.name, 'Factures'));

      if (!invoicesFolder) {
        [invoicesFolder] = await db
          .insert(folder)
          .values({ name: 'Factures' })
          .returning({ id: folder.id });
      }

      // Créer l'entrée media dans le dossier Factures
      const [mediaEntry] = await db
        .insert(media)
        .values({
          folder: invoicesFolder.id,
          filenameDisk,
          filenameOriginal: `${result.number}.pdf`,
          title: `Facture ${result.number}`,
          mimeType: 'application/pdf',
          size: result.pdfBuffer.length,
        })
        .returning();

      // Mettre à jour la facture avec le PDF
      await db.update(invoice).set({ pdf: mediaEntry.id }).where(eq(invoice.id, result.invoiceId));

      return {
        id: result.invoiceId,
        number: result.number,
        pdfUrl: `/assets/${mediaEntry.id}`,
      };
    },
    {
      permission: true,
      params: uuidParam,
      body: t.Optional(
        t.Object({
          type: t.Optional(t.Union([t.Literal('invoice'), t.Literal('credit_note')])),
          dateDue: t.Optional(t.String()),
        }),
      ),
      response: withCrudErrors({ 200: invoiceCreatedSchema }),
    },
  )

  // === INVOICES (READ PDF) ===
  .use(permissionGuard('order', 'read'))

  // GET /orders/:id/invoices/:invoiceId/pdf - Télécharger le PDF d'une facture
  .get(
    '/:id/invoices/:invoiceId/pdf',
    async ({ params, status, set }) => {
      // Vérifier que la facture existe et appartient à cette commande
      const [inv] = await db
        .select()
        .from(invoice)
        .where(and(eq(invoice.id, params.invoiceId), eq(invoice.order, params.id)));

      if (!inv) {
        return status(404, { message: 'Facture introuvable' });
      }

      // Si un PDF est stocké, le servir
      if (inv.pdf) {
        const [mediaEntry] = await db.select().from(media).where(eq(media.id, inv.pdf));

        if (mediaEntry) {
          const filePath = join(UPLOAD_DIR, mediaEntry.filenameDisk);
          const file = Bun.file(filePath);

          if (await file.exists()) {
            set.headers['Content-Type'] = 'application/pdf';
            set.headers['Content-Disposition'] = `inline; filename="${inv.number}.pdf"`;
            return file;
          }
        }
      }

      // Sinon, régénérer le PDF à la volée et le re-stocker
      const pdfBuffer = await regenerateInvoicePdf(params.invoiceId);

      // Re-stocker dans la médiathèque
      const filenameDisk = `${randomUUID()}.pdf`;
      const filePath = join(UPLOAD_DIR, filenameDisk);
      await Bun.write(filePath, pdfBuffer);

      // Trouver ou créer le dossier "Factures"
      let [invoicesFolder] = await db
        .select({ id: folder.id })
        .from(folder)
        .where(eq(folder.name, 'Factures'));

      if (!invoicesFolder) {
        [invoicesFolder] = await db
          .insert(folder)
          .values({ name: 'Factures' })
          .returning({ id: folder.id });
      }

      // Créer l'entrée media
      const [mediaEntry] = await db
        .insert(media)
        .values({
          folder: invoicesFolder.id,
          filenameDisk,
          filenameOriginal: `${inv.number}.pdf`,
          title: `Facture ${inv.number}`,
          mimeType: 'application/pdf',
          size: pdfBuffer.length,
        })
        .returning();

      // Mettre à jour la facture avec le nouveau PDF
      await db.update(invoice).set({ pdf: mediaEntry.id }).where(eq(invoice.id, inv.id));

      set.headers['Content-Type'] = 'application/pdf';
      set.headers['Content-Disposition'] = `inline; filename="${inv.number}.pdf"`;
      return new Response(new Uint8Array(pdfBuffer));
    },
    {
      permission: true,
      params: t.Object({
        id: t.String({ format: 'uuid' }),
        invoiceId: t.String({ format: 'uuid' }),
      }),
    },
  );

// Helper: décrémente le stock quand commande confirmée
async function decrementStock(orderId: string) {
  const items = await db.select().from(orderItem).where(eq(orderItem.order, orderId));

  for (const item of items) {
    if (!item.variant) continue;

    // Create stock move
    await db.insert(stockMove).values({
      variant: item.variant,
      label: item.label,
      quantity: -item.quantity,
      type: 'sale',
      reference: orderId,
    });

    // Update variant quantity
    await db
      .update(variant)
      .set({ quantity: sql`${variant.quantity} - ${item.quantity}` })
      .where(eq(variant.id, item.variant));
  }
}

// Helper: incrémente le stock quand commande annulée ou remboursée
async function incrementStock(orderId: string, note = 'Commande annulée') {
  const items = await db.select().from(orderItem).where(eq(orderItem.order, orderId));

  for (const item of items) {
    if (!item.variant) continue;

    // Create stock move (return)
    await db.insert(stockMove).values({
      variant: item.variant,
      label: item.label,
      quantity: item.quantity,
      type: 'return',
      reference: orderId,
      note,
    });

    // Update variant quantity
    await db
      .update(variant)
      .set({ quantity: sql`${variant.quantity} + ${item.quantity}` })
      .where(eq(variant.id, item.variant));
  }
}
