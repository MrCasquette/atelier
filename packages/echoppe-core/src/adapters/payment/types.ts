// SSOT des providers de paiement — ajouter un provider = l'inscrire ici (+ son adapter + ses
// credentials). La route webhook (`/webhook/:provider`) et les listings sont pilotés par cette
// liste, jamais par un enum codé en dur route par route.
export const PAYMENT_PROVIDERS = ['stripe', 'paypal'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export function isPaymentProvider(value: string): value is PaymentProvider {
  return (PAYMENT_PROVIDERS as readonly string[]).includes(value);
}

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface CheckoutSession {
  id: string;
  url: string;
  provider: PaymentProvider;
}

export interface CheckoutParams {
  orderId: string;
  amount: number; // En centimes
  currency: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  lineItems?: LineItem[];
}

export interface LineItem {
  name: string;
  quantity: number;
  unitAmount: number; // En centimes
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  status: PaymentStatus;
  orderId?: string;
  amount?: number;
  rawData: unknown;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

export interface CaptureResult {
  success: boolean;
  error?: string;
}

export interface PaymentAdapter {
  readonly provider: PaymentProvider;

  /**
   * Crée une session de checkout et retourne l'URL de redirection
   */
  createCheckout(params: CheckoutParams): Promise<CheckoutSession>;

  /**
   * Vérifie et parse un webhook entrant. Chaque adapter extrait/valide LUI-MÊME les headers de
   * signature qui le concernent (stripe-signature, paypal-transmission-*…) → la route reste
   * agnostique du provider.
   * @param payload - Le body brut du webhook
   * @param headers - Tous les headers de la requête (clés en minuscules)
   */
  verifyWebhook(payload: string, headers: Record<string, string>): Promise<PaymentResult>;

  /**
   * Effectue un remboursement (total ou partiel)
   */
  refund(transactionId: string, amount?: number): Promise<RefundResult>;

  /**
   * Finalise l'encaissement des fonds après confirmation de la commande.
   * Stripe : capture l'autorisation manuelle. PayPal : no-op (déjà capturé à l'approbation).
   * Toujours présent → l'appelant exprime l'intention sans brancher sur le provider.
   */
  capture(transactionId: string): Promise<CaptureResult>;

  /**
   * Restitue les fonds au client car la commande ne sera pas honorée (rupture de stock).
   * Stripe : annule l'autorisation non capturée (aucun débit). PayPal : rembourse la capture.
   * La différence de fonctionnement réelle entre providers vit dans l'adapter, pas chez l'appelant.
   */
  cancelOrRefund(transactionId: string): Promise<CaptureResult>;

  /**
   * Vérifie si l'adapter est configuré (credentials présents et activé)
   */
  isConfigured(): Promise<boolean>;
}
