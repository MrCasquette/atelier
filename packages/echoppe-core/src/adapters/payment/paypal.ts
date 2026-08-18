// @ts-expect-error - No official types for PayPal SDK
import paypal from '@paypal/checkout-server-sdk';
import type { CredentialStore } from '@repo/adapters';
import type { PayPalCredentials } from './config';
import type {
  CaptureResult,
  CheckoutParams,
  CheckoutSession,
  PaymentAdapter,
  PaymentResult,
  RefundResult,
} from './types';
import { isRecord } from '@repo/shared';

export class PayPalAdapter implements PaymentAdapter {
  readonly provider = 'paypal' as const;
  private client: paypal.core.PayPalHttpClient | null = null;
  private initialized = false;

  // DIP : la source des credentials est injectée (registre = base ; test = stub).
  constructor(private readonly credentials: CredentialStore<PayPalCredentials>) {}

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const credentials = await this.credentials.get();
    if (credentials) {
      const environment =
        credentials.mode === 'live'
          ? new paypal.core.LiveEnvironment(credentials.clientId, credentials.clientSecret)
          : new paypal.core.SandboxEnvironment(credentials.clientId, credentials.clientSecret);

      this.client = new paypal.core.PayPalHttpClient(environment);
    }
    this.initialized = true;
  }

  async isConfigured(): Promise<boolean> {
    return (await this.credentials.get()) !== null;
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutSession> {
    await this.ensureInitialized();

    if (!this.client) {
      throw new Error('PayPal is not configured.');
    }

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');

    const items =
      params.lineItems?.map((item) => ({
        name: item.name,
        quantity: String(item.quantity),
        unit_amount: {
          currency_code: params.currency.toUpperCase(),
          value: (item.unitAmount / 100).toFixed(2),
        },
      })) ?? [];

    const totalValue = (params.amount / 100).toFixed(2);

    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.orderId,
          custom_id: params.orderId,
          amount: {
            currency_code: params.currency.toUpperCase(),
            value: totalValue,
            breakdown:
              items.length > 0
                ? {
                    item_total: {
                      currency_code: params.currency.toUpperCase(),
                      value: totalValue,
                    },
                  }
                : undefined,
          },
          items: items.length > 0 ? items : undefined,
        },
      ],
      application_context: {
        return_url: params.successUrl,
        cancel_url: params.cancelUrl,
        brand_name: process.env.SHOP_NAME ?? 'Shop',
        user_action: 'PAY_NOW',
      },
    });

    const response = await this.client.execute(request);
    const order = response.result;

    const approveLink = order.links?.find(
      (link: { rel: string; href: string }) => link.rel === 'approve',
    );

    if (!approveLink?.href) {
      throw new Error('PayPal order created without approval URL');
    }

    return {
      id: order.id,
      url: approveLink.href,
      provider: 'paypal',
    };
  }

  async verifyWebhook(payload: string, headers: Record<string, string>): Promise<PaymentResult> {
    await this.ensureInitialized();

    if (!this.client) {
      throw new Error('PayPal is not configured.');
    }

    // Vérifier la signature via l'API PayPal
    const credentials = await this.credentials.get();
    if (!credentials?.webhookId) {
      throw new Error('PayPal webhook ID not configured');
    }

    // Headers de signature PayPal requis (l'adapter valide les siens, la route reste agnostique).
    const required = [
      'paypal-auth-algo',
      'paypal-cert-url',
      'paypal-transmission-id',
      'paypal-transmission-sig',
      'paypal-transmission-time',
    ];
    const missing = required.filter((h) => !headers[h]);
    if (missing.length > 0) {
      throw new Error(`Missing PayPal webhook headers: ${missing.join(', ')}`);
    }

    // Appeler l'API PayPal pour vérifier la signature
    const isValid = await this.verifyWebhookSignature(payload, headers, credentials.webhookId);
    if (!isValid) {
      throw new Error('PayPal webhook signature verification failed');
    }

    const event = JSON.parse(payload);

    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const resource = event.resource;
        const orderId =
          resource.custom_id ??
          resource.purchase_units?.[0]?.reference_id ??
          resource.purchase_units?.[0]?.custom_id;

        return {
          success: true,
          transactionId: resource.id,
          status: 'completed',
          orderId,
          amount: resource.amount ? Math.round(parseFloat(resource.amount.value) * 100) : undefined,
          rawData: resource,
        };
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED': {
        const resource = event.resource;
        return {
          success: false,
          transactionId: resource.id,
          status: 'failed',
          rawData: resource,
        };
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        const resource = event.resource;
        return {
          success: true,
          transactionId: resource.id,
          status: 'refunded',
          rawData: resource,
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

  /**
   * Vérifie la signature du webhook via l'API PayPal
   * @see https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature
   */
  private async verifyWebhookSignature(
    payload: string,
    headers: Record<string, string>,
    webhookId: string,
  ): Promise<boolean> {
    const credentials = await this.credentials.get();
    if (!credentials) {
      throw new Error('PayPal credentials not found');
    }

    // Obtenir un access token
    const baseUrl =
      credentials.mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    const authString = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
      'base64',
    );

    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get PayPal access token: ${tokenResponse.status}`);
    }

    // Une réponse d'API tierce est une frontière : on vérifie le seul champ qu'on lit, plutôt que
    // d'affirmer une forme qu'on n'a pas produite.
    const tokenData: unknown = await tokenResponse.json();
    if (!isRecord(tokenData) || typeof tokenData.access_token !== 'string') {
      throw new Error('Réponse PayPal inattendue : access_token absent.');
    }

    // Vérifier la signature du webhook
    // IMPORTANT: Le webhook_event doit être le payload JSON brut, pas re-sérialisé
    const verifyResponse = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: JSON.parse(payload),
      }),
    });

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error('[PayPal] Webhook verification API error', {
        status: verifyResponse.status,
        error: errorText,
      });
      return false;
    }

    const verifyData: unknown = await verifyResponse.json();
    return isRecord(verifyData) && verifyData.verification_status === 'SUCCESS';
  }

  async refund(transactionId: string, amount?: number): Promise<RefundResult> {
    await this.ensureInitialized();

    if (!this.client) {
      throw new Error('PayPal is not configured.');
    }

    try {
      const request = new paypal.payments.CapturesRefundRequest(transactionId);

      if (amount) {
        request.requestBody({
          amount: {
            currency_code: 'EUR',
            value: (amount / 100).toFixed(2),
          },
        });
      }

      const response = await this.client.execute(request);

      return {
        success: response.result.status === 'COMPLETED',
        refundId: response.result.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async capture(_transactionId: string): Promise<CaptureResult> {
    // PayPal encaisse dès l'approbation (intent CAPTURE) : rien à finaliser côté serveur.
    return { success: true };
  }

  async cancelOrRefund(transactionId: string): Promise<CaptureResult> {
    // Les fonds sont déjà encaissés → restituer = rembourser la capture.
    const result = await this.refund(transactionId);
    return { success: result.success, error: result.error };
  }
}
