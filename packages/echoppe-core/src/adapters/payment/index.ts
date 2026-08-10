export {
  getProviderCredentials,
  getProviderStatus,
  type PayPalCredentials,
  type StripeCredentials,
  saveProviderCredentials,
  setProviderEnabled,
} from './config';
export { PayPalAdapter } from './paypal';
export { StripeAdapter } from './stripe';
export type {
  CheckoutParams,
  CheckoutSession,
  LineItem,
  PaymentAdapter,
  PaymentProvider,
  PaymentResult,
  PaymentStatus,
  RefundResult,
} from './types';
export { isPaymentProvider, PAYMENT_PROVIDERS } from './types';

import { createAdapterRegistry } from '@repo/adapters';
import { getProviderCredentials, getProviderStatus } from './config';
import { PayPalAdapter } from './paypal';
import { StripeAdapter } from './stripe';
import { PAYMENT_PROVIDERS, type PaymentAdapter, type PaymentProvider } from './types';

// Registre déclaratif : store réel adossé à la base (credentials déchiffrés) injecté par fabrique.
const registry = createAdapterRegistry<PaymentProvider, PaymentAdapter>(PAYMENT_PROVIDERS, {
  stripe: () => new StripeAdapter({ get: () => getProviderCredentials('stripe') }),
  paypal: () => new PayPalAdapter({ get: () => getProviderCredentials('paypal') }),
});

const isReady = async (provider: PaymentProvider): Promise<boolean> => {
  const status = await getProviderStatus(provider);
  return status.isConfigured && status.isEnabled;
};

export function getPaymentAdapter(provider: PaymentProvider): PaymentAdapter {
  return registry.get(provider);
}

export function getAvailablePaymentProviders(): Promise<PaymentProvider[]> {
  return registry.available(isReady);
}

export function resetPaymentAdapters(): void {
  registry.reset();
}
