import type { CredentialStore } from '@repo/adapters';
import Stripe from 'stripe';
import type { StripeCredentials } from './config';
import type {
  CaptureResult,
  CheckoutParams,
  CheckoutSession,
  PaymentAdapter,
  PaymentResult,
  RefundResult,
} from './types';

/**
 * L'identifiant du PaymentIntent, quelle que soit la forme sous laquelle Stripe le rend.
 *
 * Le champ vaut `string`, l'objet complet (quand la requête l'a étendu) ou `null`. L'assertion qui
 * tenait ce rôle affirmait `string` dans les trois cas : un webhook étendu aurait mis un OBJET
 * dans `transactionId`, et la commande aurait été rapprochée d'un identifiant `[object Object]`.
 */
function paymentIntentId(value: string | Stripe.PaymentIntent | null): string {
  if (typeof value === 'string') return value;
  if (value) return value.id;
  throw new Error('Événement Stripe sans payment_intent : impossible de rattacher la transaction.');
}

export class StripeAdapter implements PaymentAdapter {
  readonly provider = 'stripe' as const;
  private client: Stripe | null = null;
  private webhookSecret: string | null = null;
  private initialized = false;

  // DIP : la source des credentials est injectée (registre = base ; test = stub).
  constructor(private readonly credentials: CredentialStore<StripeCredentials>) {}

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const credentials = await this.credentials.get();
    if (credentials) {
      this.client = new Stripe(credentials.secretKey);
      this.webhookSecret = credentials.webhookSecret;
    }
    this.initialized = true;
  }

  async isConfigured(): Promise<boolean> {
    return (await this.credentials.get()) !== null;
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutSession> {
    await this.ensureInitialized();

    if (!this.client) {
      throw new Error('Stripe is not configured.');
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = params.lineItems?.map(
      (item) => ({
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: { name: item.name },
          unit_amount: item.unitAmount,
        },
        quantity: item.quantity,
      }),
    ) ?? [
      {
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: { name: `Commande ${params.orderId}` },
          unit_amount: params.amount,
        },
        quantity: 1,
      },
    ];

    const session = await this.client.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      // Capture manuelle : Stripe autorise (empreinte) sans débiter. La capture
      // ou l'annulation est décidée au webhook, après revérification du stock.
      payment_intent_data: { capture_method: 'manual' },
      line_items: lineItems,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail,
      metadata: {
        orderId: params.orderId,
        ...params.metadata,
      },
      client_reference_id: params.orderId,
    });

    if (!session.url) {
      throw new Error('Stripe session created without URL');
    }

    return {
      id: session.id,
      url: session.url,
      provider: 'stripe',
    };
  }

  async verifyWebhook(payload: string, headers: Record<string, string>): Promise<PaymentResult> {
    await this.ensureInitialized();

    if (!this.client || !this.webhookSecret) {
      throw new Error('Stripe webhook is not configured.');
    }

    const signature = headers['stripe-signature'];
    if (!signature) {
      throw new Error('Missing stripe-signature header');
    }

    const event = this.client.webhooks.constructEvent(payload, signature, this.webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        return {
          success: true,
          transactionId: paymentIntentId(session.payment_intent),
          status: 'completed',
          orderId: session.metadata?.orderId ?? session.client_reference_id ?? undefined,
          amount: session.amount_total ?? undefined,
          rawData: session,
        };
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        return {
          success: false,
          transactionId: session.id,
          status: 'failed',
          orderId: session.metadata?.orderId ?? session.client_reference_id ?? undefined,
          rawData: session,
        };
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        return {
          success: true,
          transactionId: paymentIntentId(charge.payment_intent),
          status: 'refunded',
          amount: charge.amount_refunded,
          rawData: charge,
        };
      }

      default:
        return {
          success: false,
          transactionId: '',
          status: 'pending',
          rawData: event,
        };
    }
  }

  async refund(transactionId: string, amount?: number): Promise<RefundResult> {
    await this.ensureInitialized();

    if (!this.client) {
      throw new Error('Stripe is not configured.');
    }

    try {
      const refund = await this.client.refunds.create({
        payment_intent: transactionId,
        amount,
      });

      return {
        success: refund.status === 'succeeded',
        refundId: refund.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async capture(transactionId: string): Promise<CaptureResult> {
    await this.ensureInitialized();

    if (!this.client) {
      throw new Error('Stripe is not configured.');
    }

    try {
      const intent = await this.client.paymentIntents.capture(transactionId);
      return { success: intent.status === 'succeeded' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async cancelOrRefund(transactionId: string): Promise<CaptureResult> {
    await this.ensureInitialized();

    if (!this.client) {
      throw new Error('Stripe is not configured.');
    }

    try {
      // PaymentIntent en `requires_capture` : l'annulation libère les fonds
      // autorisés, le client n'est jamais débité.
      await this.client.paymentIntents.cancel(transactionId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
