import type { PaymentProvider, PayPalCredentials, StripeCredentials } from '@echoppe/core';
import {
  and,
  cart,
  customer,
  db,
  eq,
  getPaymentAdapter,
  getProviderStatus,
  gte,
  isEncryptionConfigured,
  isPaymentProvider,
  order,
  orderItem,
  payment,
  paymentEvent,
  resetPaymentAdapters,
  saveProviderCredentials,
  sendOrderConfirmation,
  sql,
  stockMove,
  variant,
} from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { rateLimit } from 'elysia-rate-limit';
import { customerAuthPlugin, type SessionCustomer } from '../plugins/customerAuth';
import { permissionGuard } from '../plugins/rbac';
import { webhookRateLimitOptions } from '../utils/rate-limit';
import { errorSchema, successSchema } from '../utils/responses';
import { validateCheckoutUrls } from '../utils/url-validation';

const checkoutBody = t.Object({
  orderId: t.String({ format: 'uuid' }),
  provider: t.Union([t.Literal('stripe'), t.Literal('paypal')]),
  successUrl: t.String({ format: 'uri' }),
  cancelUrl: t.String({ format: 'uri' }),
});

const uuidParam = t.Object({
  orderId: t.String({ format: 'uuid' }),
});

const stripeConfigBody = t.Object({
  secretKey: t.String({ minLength: 1 }),
  webhookSecret: t.String({ minLength: 1 }),
  isEnabled: t.Optional(t.Boolean()),
});

const paypalConfigBody = t.Object({
  clientId: t.String({ minLength: 1 }),
  clientSecret: t.String({ minLength: 1 }),
  mode: t.Union([t.Literal('sandbox'), t.Literal('live')]),
  webhookId: t.String({ minLength: 1 }),
  isEnabled: t.Optional(t.Boolean()),
});

// Response schemas

const providerFieldSchema = t.Object({
  key: t.String(),
  label: t.String(),
  type: t.String(),
  placeholder: t.Optional(t.String()),
});

const providerStatusSchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.String(),
  fields: t.Array(providerFieldSchema),
  isConfigured: t.Boolean(),
  isEnabled: t.Boolean(),
  encryptionReady: t.Boolean(),
});

const checkoutSessionSchema = t.Object({
  sessionId: t.String(),
  url: t.String(),
  provider: t.String(),
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

const webhookReceivedSchema = t.Object({ received: t.Boolean() });

const refundResultSchema = t.Object({
  success: t.Boolean(),
  refundId: t.Optional(t.String()),
});

const providerMeta: Record<
  PaymentProvider,
  {
    name: string;
    description: string;
    fields: { key: string; label: string; type: string; placeholder?: string }[];
  }
> = {
  stripe: {
    name: 'Stripe',
    description: 'Paiements par carte bancaire',
    fields: [
      { key: 'secretKey', label: 'Clé secrète', type: 'password', placeholder: 'sk_live_...' },
      { key: 'webhookSecret', label: 'Secret webhook', type: 'password', placeholder: 'whsec_...' },
    ],
  },
  paypal: {
    name: 'PayPal',
    description: 'Paiements via compte PayPal',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'AX...' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'EL...' },
      { key: 'mode', label: 'Mode', type: 'select', placeholder: 'sandbox' },
      { key: 'webhookId', label: 'Webhook ID', type: 'text', placeholder: 'WH-...' },
    ],
  },
};

export const paymentsRoutes = new Elysia({ prefix: '/payments', detail: { tags: ['Payments'] } })

  // === PAYMENT CONFIG READ ===
  .use(permissionGuard('payment_config', 'read'))

  // GET /payments/providers - Liste des providers avec statut
  .get(
    '/providers',
    async () => {
      const providers: PaymentProvider[] = ['stripe', 'paypal'];
      const encryptionReady = isEncryptionConfigured();

      const result = await Promise.all(
        providers.map(async (id) => {
          const status = await getProviderStatus(id);
          return {
            id,
            ...providerMeta[id],
            ...status,
            encryptionReady,
          };
        }),
      );

      return result;
    },
    { permission: true, response: { 200: t.Array(providerStatusSchema) } },
  )

  // === PAYMENT CONFIG UPDATE ===
  .use(permissionGuard('payment_config', 'update'))

  // PUT /payments/providers/stripe - Configure Stripe
  .put(
    '/providers/stripe',
    async ({ body, status }) => {
      if (!isEncryptionConfigured()) {
        return status(400, { message: 'ENCRYPTION_KEY non configurée' });
      }

      const credentials: StripeCredentials = {
        secretKey: body.secretKey,
        webhookSecret: body.webhookSecret,
      };

      await saveProviderCredentials('stripe', credentials, body.isEnabled ?? true);
      resetPaymentAdapters();

      return { success: true };
    },
    {
      permission: true,
      body: stripeConfigBody,
      response: { 200: successSchema, 400: errorSchema },
    },
  )

  // PUT /payments/providers/paypal - Configure PayPal
  .put(
    '/providers/paypal',
    async ({ body, status }) => {
      if (!isEncryptionConfigured()) {
        return status(400, { message: 'ENCRYPTION_KEY non configurée' });
      }

      const credentials: PayPalCredentials = {
        clientId: body.clientId,
        clientSecret: body.clientSecret,
        mode: body.mode,
        webhookId: body.webhookId,
      };

      await saveProviderCredentials('paypal', credentials, body.isEnabled ?? true);
      resetPaymentAdapters();

      return { success: true };
    },
    {
      permission: true,
      body: paypalConfigBody,
      response: { 200: successSchema, 400: errorSchema },
    },
  )

  // === CUSTOMER CHECKOUT (requires customer auth) ===
  .use(customerAuthPlugin)

  // POST /payments/checkout - Créer une session de paiement (customer auth required)
  .post(
    '/checkout',
    async ({ body, currentCustomer, status }) => {
      const customerData = currentCustomer as SessionCustomer;

      // Validate redirect URLs (prevent open redirect)
      const urlError = validateCheckoutUrls(body.successUrl, body.cancelUrl);
      if (urlError) {
        return status(400, { message: urlError });
      }

      const adapter = getPaymentAdapter(body.provider);

      if (!(await adapter.isConfigured())) {
        return status(400, { message: `Provider ${body.provider} non configuré` });
      }

      // Récupérer la commande
      const [orderData] = await db
        .select({
          id: order.id,
          customer: order.customer,
          orderNumber: order.orderNumber,
          totalTtc: order.totalTtc,
        })
        .from(order)
        .where(eq(order.id, body.orderId));

      if (!orderData) {
        return status(404, { message: 'Commande introuvable' });
      }

      // SECURITY: Verify order belongs to the authenticated customer
      if (orderData.customer !== customerData.id) {
        return status(403, { message: 'Accès non autorisé à cette commande' });
      }

      // Vérifier qu'il n'y a pas déjà un paiement complété
      const [existingPayment] = await db
        .select()
        .from(payment)
        .where(eq(payment.order, body.orderId));

      if (existingPayment?.status === 'completed') {
        return status(400, { message: 'Cette commande a déjà été payée' });
      }

      // Montant en centimes
      const amountCents = Math.round(parseFloat(orderData.totalTtc) * 100);

      // Créer la session de checkout
      const session = await adapter.createCheckout({
        orderId: body.orderId,
        amount: amountCents,
        currency: 'EUR',
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        metadata: {
          orderNumber: orderData.orderNumber,
        },
      });

      // Créer ou mettre à jour l'entrée payment
      if (existingPayment) {
        await db
          .update(payment)
          .set({
            provider: body.provider,
            status: 'pending',
            dateUpdated: new Date(),
          })
          .where(eq(payment.id, existingPayment.id));
      } else {
        await db.insert(payment).values({
          order: body.orderId,
          provider: body.provider,
          status: 'pending',
          amount: orderData.totalTtc,
        });
      }

      // Log l'événement
      const [paymentRecord] = await db
        .select()
        .from(payment)
        .where(eq(payment.order, body.orderId));

      if (paymentRecord) {
        await db.insert(paymentEvent).values({
          payment: paymentRecord.id,
          type: 'checkout_created',
          data: { sessionId: session.id, provider: body.provider },
        });
      }

      return {
        sessionId: session.id,
        url: session.url,
        provider: session.provider,
      };
    },
    {
      customerAuth: true,
      cookie: t.Cookie({ echoppe_customer_session: t.Optional(t.String()) }),
      body: checkoutBody,
      response: {
        200: checkoutSessionSchema,
        400: errorSchema,
        403: errorSchema,
        404: errorSchema,
      },
    },
  )

  // Webhooks providers (publics) : UNE route paramétrique — ajouter un provider = un adapter, zéro
  // route. Chaque adapter extrait/valide ses propres headers de signature (route agnostique).
  // Rate-limit IP dédié dans une sous-instance `scoped` → n'affecte pas les routes admin suivantes.
  .use(
    new Elysia().use(rateLimit(webhookRateLimitOptions)).post(
      '/webhook/:provider',
      async ({ params, request, status }) => {
        if (!isPaymentProvider(params.provider)) {
          return status(404, { message: `Unknown payment provider: ${params.provider}` });
        }

        const payload = await request.text();
        const headers = Object.fromEntries(request.headers);
        const adapter = getPaymentAdapter(params.provider);

        try {
          const result = await adapter.verifyWebhook(payload, headers);

          console.log('[Webhook] Event received', {
            provider: params.provider,
            orderId: result.orderId ?? 'N/A',
            status: result.status,
            transactionId: result.transactionId,
            timestamp: new Date().toISOString(),
          });

          if (result.orderId && result.status !== 'pending') {
            await handlePaymentResult(result.orderId, params.provider, result);
          }

          return { received: true };
        } catch (error) {
          console.error('[Webhook] Verification failed', {
            provider: params.provider,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          });
          return status(400, { message: 'Webhook verification failed' });
        }
      },
      {
        params: t.Object({ provider: t.String() }),
        response: { 200: webhookReceivedSchema, 400: errorSchema, 404: errorSchema },
      },
    ),
  )

  // === ORDER READ (payment status) ===
  .use(permissionGuard('order', 'read'))

  // GET /payments/:orderId - Statut du paiement
  .get(
    '/:orderId',
    async ({ params, status }) => {
      const [paymentData] = await db
        .select()
        .from(payment)
        .where(eq(payment.order, params.orderId));

      if (!paymentData) {
        return status(404, { message: 'Paiement introuvable' });
      }

      return paymentData;
    },
    { permission: true, params: uuidParam, response: { 200: paymentSchema, 404: errorSchema } },
  )

  // === ORDER UPDATE (refund) ===
  .use(permissionGuard('order', 'update'))

  // POST /payments/:orderId/refund - Rembourser (admin)
  .post(
    '/:orderId/refund',
    async ({ params, body, status }) => {
      const [paymentData] = await db
        .select()
        .from(payment)
        .where(eq(payment.order, params.orderId));

      if (!paymentData) {
        return status(404, { message: 'Paiement introuvable' });
      }

      if (paymentData.status !== 'completed') {
        return status(400, { message: 'Seuls les paiements complétés peuvent être remboursés' });
      }

      if (!paymentData.providerTransactionId) {
        return status(400, { message: 'Transaction ID manquant' });
      }

      const adapter = getPaymentAdapter(paymentData.provider as PaymentProvider);
      const amountCents = body.amount ? Math.round(body.amount * 100) : undefined;

      const result = await adapter.refund(paymentData.providerTransactionId, amountCents);

      if (result.success) {
        await db
          .update(payment)
          .set({ status: 'refunded', dateUpdated: new Date() })
          .where(eq(payment.id, paymentData.id));

        await db.insert(paymentEvent).values({
          payment: paymentData.id,
          type: 'refund',
          data: { refundId: result.refundId, amount: body.amount },
        });

        // Mettre à jour le statut de la commande
        await db
          .update(order)
          .set({ status: 'refunded', dateUpdated: new Date() })
          .where(eq(order.id, params.orderId));
      }

      return result;
    },
    {
      permission: true,
      params: uuidParam,
      body: t.Object({
        amount: t.Optional(t.Number({ minimum: 0 })),
      }),
      response: { 200: refundResultSchema, 400: errorSchema, 404: errorSchema },
    },
  );

// Erreur interne signalant un stock insuffisant au moment de la capture
// (déclenche l'annulation de l'autorisation / le remboursement).
class InsufficientStockError extends Error {
  constructor(readonly variantId: string) {
    super(`Insufficient stock for variant ${variantId}`);
    this.name = 'InsufficientStockError';
  }
}

// Helper pour traiter les résultats de paiement
async function handlePaymentResult(
  orderId: string,
  provider: PaymentProvider,
  result: { transactionId: string; status: string; rawData: unknown },
) {
  const adapter = getPaymentAdapter(provider);

  const [paymentData] = await db.select().from(payment).where(eq(payment.order, orderId));

  if (!paymentData) {
    console.error(`Payment not found for order ${orderId}`);
    return;
  }

  // Journaliser l'événement reçu (audit), y compris les rejeux
  await db.insert(paymentEvent).values({
    payment: paymentData.id,
    type: result.status === 'completed' ? 'success' : result.status,
    data: result.rawData,
  });

  // Événements non finaux (failed / refunded / …) : simple mise à jour du statut
  if (result.status !== 'completed') {
    await db
      .update(payment)
      .set({
        status: result.status as 'failed' | 'refunded',
        providerTransactionId: result.transactionId,
        dateUpdated: new Date(),
      })
      .where(eq(payment.id, paymentData.id));
    return;
  }

  // Idempotence : un webhook rejoué ne doit pas re-décrémenter le stock
  if (paymentData.status === 'completed') {
    console.log(`[Payment] Order ${orderId} already processed, skipping (idempotency)`);
    return;
  }

  const [orderData] = await db
    .select({
      customerId: order.customer,
      orderNumber: order.orderNumber,
      totalTtc: order.totalTtc,
    })
    .from(order)
    .where(eq(order.id, orderId));

  if (!orderData) {
    console.error(`Order not found for payment ${paymentData.id}`);
    return;
  }

  const items = await db
    .select({
      variantId: orderItem.variant,
      quantity: orderItem.quantity,
      label: orderItem.label,
    })
    .from(orderItem)
    .where(eq(orderItem.order, orderId));

  // Décrément atomique gardé + marquage, sérialisé par un verrou sur le paiement
  let stockAvailable = true;
  try {
    await db.transaction(async (tx) => {
      // Verrou + recontrôle d'idempotence (webhooks concurrents)
      const [locked] = await tx
        .select({ status: payment.status })
        .from(payment)
        .where(eq(payment.id, paymentData.id))
        .for('update');
      if (locked?.status === 'completed') return;

      for (const item of items) {
        if (!item.variantId) continue;

        // La clause `quantity >= qty` EST la revérification : garde anti-survente
        const decremented = await tx
          .update(variant)
          .set({ quantity: sql`${variant.quantity} - ${item.quantity}` })
          .where(and(eq(variant.id, item.variantId), gte(variant.quantity, item.quantity)))
          .returning({ id: variant.id });

        if (decremented.length === 0) {
          throw new InsufficientStockError(item.variantId);
        }

        await tx.insert(stockMove).values({
          variant: item.variantId,
          label: item.label,
          quantity: -item.quantity,
          type: 'sale',
          reference: orderData.orderNumber,
        });
      }

      await tx
        .update(payment)
        .set({
          status: 'completed',
          providerTransactionId: result.transactionId,
          dateUpdated: new Date(),
        })
        .where(eq(payment.id, paymentData.id));

      await tx
        .update(order)
        .set({ status: 'confirmed', dateUpdated: new Date() })
        .where(eq(order.id, orderId));
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      stockAvailable = false;
    } else {
      throw error; // erreur inattendue → webhook 400, le provider retentera
    }
  }

  // Rupture : restituer les fonds au client. L'adapter décide du geste (Stripe annule
  // l'autorisation, PayPal rembourse) — l'appelant exprime juste l'intention.
  if (!stockAvailable) {
    await adapter.cancelOrRefund(result.transactionId);
    await db
      .update(payment)
      .set({
        status: 'failed',
        providerTransactionId: result.transactionId,
        dateUpdated: new Date(),
      })
      .where(eq(payment.id, paymentData.id));
    await db
      .update(order)
      .set({ status: 'cancelled', dateUpdated: new Date() })
      .where(eq(order.id, orderId));
    console.warn(`[Payment] Order ${orderId} cancelled — insufficient stock, funds released`);
    return;
  }

  // Succès : finaliser l'encaissement. L'adapter décide (Stripe capture l'autorisation ;
  // PayPal no-op car déjà capturé).
  const captured = await adapter.capture(result.transactionId);
  if (!captured.success) {
    // Stock décrémenté et commande confirmée mais capture échouée (rare) : l'autorisation
    // reste valide, à recapturer manuellement. On alerte.
    console.error(`[Payment] Capture failed for order ${orderId}: ${captured.error ?? 'unknown'}`);
  }

  // Convertir le panier actif et envoyer la confirmation
  await db
    .update(cart)
    .set({ status: 'converted', dateUpdated: new Date() })
    .where(and(eq(cart.customer, orderData.customerId), eq(cart.status, 'active')));

  const [customerData] = await db
    .select({ email: customer.email, firstName: customer.firstName })
    .from(customer)
    .where(eq(customer.id, orderData.customerId));

  if (customerData) {
    await sendOrderConfirmation({
      customerEmail: customerData.email,
      customerName: customerData.firstName ?? undefined,
      orderNumber: orderData.orderNumber,
      total: orderData.totalTtc,
    });
  }
}
