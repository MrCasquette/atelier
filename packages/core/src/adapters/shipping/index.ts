export { ColissimoAdapter } from './colissimo';
export {
  type ColissimoCredentials,
  getShippingProviderCredentials,
  getShippingProviderStatus,
  type MondialRelayCredentials,
  type SendcloudCredentials,
  saveShippingProviderCredentials,
  setShippingProviderEnabled,
} from './config';
export { MondialRelayAdapter } from './mondialrelay';
export { SendcloudAdapter } from './sendcloud';
export type {
  Address,
  CreateLabelParams,
  GetRatesParams,
  ShipmentLabel,
  ShippingAdapter,
  ShippingProvider,
  ShippingRate,
  TrackingEvent,
} from './types';
export { isShippingProvider, SHIPPING_PROVIDERS } from './types';

import { createAdapterRegistry } from '@repo/adapters';
import { ColissimoAdapter } from './colissimo';
import { getShippingProviderCredentials, getShippingProviderStatus } from './config';
import { MondialRelayAdapter } from './mondialrelay';
import { SendcloudAdapter } from './sendcloud';
import { SHIPPING_PROVIDERS, type ShippingAdapter, type ShippingProvider } from './types';

// Registre déclaratif : store réel adossé à la base (credentials déchiffrés) injecté par fabrique.
const registry = createAdapterRegistry<ShippingProvider, ShippingAdapter>(SHIPPING_PROVIDERS, {
  colissimo: () => new ColissimoAdapter({ get: () => getShippingProviderCredentials('colissimo') }),
  mondialrelay: () =>
    new MondialRelayAdapter({ get: () => getShippingProviderCredentials('mondialrelay') }),
  sendcloud: () => new SendcloudAdapter({ get: () => getShippingProviderCredentials('sendcloud') }),
});

const isReady = async (provider: ShippingProvider): Promise<boolean> => {
  const status = await getShippingProviderStatus(provider);
  return status.isConfigured && status.isEnabled;
};

export function getShippingAdapter(provider: ShippingProvider): ShippingAdapter {
  return registry.get(provider);
}

export function getAvailableShippingProviders(): Promise<ShippingProvider[]> {
  return registry.available(isReady);
}

export function resetShippingAdapters(): void {
  registry.reset();
}
