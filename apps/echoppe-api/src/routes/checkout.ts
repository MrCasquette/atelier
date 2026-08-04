import { getAvailablePaymentProviders, getPaymentAdapter } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { rateLimit } from 'elysia-rate-limit';
import { models } from '../models';
import { customerAuthPlugin, type SessionCustomer } from '../plugins/customerAuth';
import {
  calculateOrderTotals,
  createAddressSnapshot,
  createOrder,
  generateOrderNumber,
  getActiveCart,
  getCartItems,
  initiatePayment,
  rollbackOrder,
  validateStock,
} from '../services/checkout';
import { checkoutRateLimitOptions } from '../utils/rate-limit';
import { errorSchema, withReadErrors } from '../utils/responses';
import { validateCheckoutUrls } from '../utils/url-validation';

// ============================================================================
// SCHEMAS
// ============================================================================

const addressInputSchema = t.Object({
  firstName: t.String({ minLength: 1, maxLength: 100 }),
  lastName: t.String({ minLength: 1, maxLength: 100 }),
  company: t.Optional(t.String({ maxLength: 100 })),
  street: t.String({ minLength: 1, maxLength: 255 }),
  street2: t.Optional(t.String({ maxLength: 255 })),
  postalCode: t.String({ minLength: 1, maxLength: 10 }),
  city: t.String({ minLength: 1, maxLength: 100 }),
  countryCode: t.String({ minLength: 2, maxLength: 2 }),
  phone: t.Optional(t.String({ maxLength: 20 })),
});

const checkoutBodySchema = t.Object({
  shippingAddress: addressInputSchema,
  billingAddress: t.Optional(addressInputSchema),
  useSameAddress: t.Optional(t.Boolean()),
  customerNote: t.Optional(t.String({ maxLength: 500 })),
  paymentProvider: t.Union([t.Literal('stripe'), t.Literal('paypal')]),
  successUrl: t.String({ format: 'uri' }),
  cancelUrl: t.String({ format: 'uri' }),
});

// Schémas d'entité (PaymentProvider(List), CheckoutResult) → src/models/checkout.ts

// ============================================================================
// ROUTES
// ============================================================================

export const checkoutRoutes = new Elysia({
  prefix: '/checkout',
  detail: { tags: ['Checkout'] },
})
  // Registre central des modèles nommés → components.schemas.
  .use(models)

  .get(
    '/payment-providers',
    async () => {
      const providers = await getAvailablePaymentProviders();
      const meta: Record<string, { name: string; description: string }> = {
        stripe: { name: 'Carte bancaire', description: 'Paiement sécurisé par carte' },
        paypal: { name: 'PayPal', description: 'Paiement via compte PayPal' },
      };
      return providers.map((id) => ({ id, ...meta[id] }));
    },
    { response: withReadErrors({ 200: 'PaymentProviderList' }) },
  )

  .use(customerAuthPlugin)
  .use(rateLimit(checkoutRateLimitOptions))

  .post(
    '/',
    async ({ body, currentCustomer, status }) => {
      const customer = currentCustomer as SessionCustomer;

      // 1. Validate URLs
      const urlError = validateCheckoutUrls(body.successUrl, body.cancelUrl);
      if (urlError) return status(400, { message: urlError });

      // 2. Get cart
      const cartData = await getActiveCart(customer.id);
      if (!cartData) return status(400, { message: 'Votre panier est vide' });

      const items = await getCartItems(cartData.id);
      if (items.length === 0) return status(400, { message: 'Votre panier est vide' });

      // 3. Validate stock
      const stockError = validateStock(items);
      if (stockError) return status(400, { message: stockError });

      // 4. Verify provider
      const adapter = getPaymentAdapter(body.paymentProvider);
      if (!(await adapter.isConfigured())) {
        return status(400, { message: `Mode de paiement ${body.paymentProvider} non disponible` });
      }

      // 5. Addresses
      const shippingSnapshot = await createAddressSnapshot(body.shippingAddress);
      if (!shippingSnapshot) return status(400, { message: 'Pays de livraison invalide' });

      const billingInput = body.useSameAddress ? body.shippingAddress : body.billingAddress;
      if (!billingInput) return status(400, { message: 'Adresse de facturation requise' });

      const billingSnapshot = body.useSameAddress
        ? shippingSnapshot
        : await createAddressSnapshot(billingInput);
      if (!billingSnapshot) return status(400, { message: 'Pays de facturation invalide' });

      // 6. Create order
      const totals = await calculateOrderTotals(items);
      const orderNumber = await generateOrderNumber();
      const createdOrder = await createOrder(
        customer.id,
        orderNumber,
        shippingSnapshot,
        billingSnapshot,
        totals,
        body.customerNote,
      );

      // 7. Payment
      try {
        const { url } = await initiatePayment(
          createdOrder.id,
          createdOrder.orderNumber,
          totals.totalTtc,
          body.paymentProvider,
          body.successUrl,
          body.cancelUrl,
        );
        return {
          orderId: createdOrder.id,
          orderNumber: createdOrder.orderNumber,
          paymentUrl: url,
          provider: body.paymentProvider,
        };
      } catch (error) {
        await rollbackOrder(createdOrder.id);
        const message =
          error instanceof Error ? error.message : 'Erreur lors de la création du paiement';
        return status(400, { message });
      }
    },
    {
      customerAuth: true,
      cookie: t.Cookie({ echoppe_customer_session: t.Optional(t.String()) }),
      body: checkoutBodySchema,
      response: { 200: 'CheckoutResult', 400: errorSchema, 429: errorSchema },
    },
  );
