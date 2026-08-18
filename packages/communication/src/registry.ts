import { createAdapterRegistry, type AdapterRegistry } from '@repo/adapters';
import { BrevoAdapter } from './brevo';
import { getProviderConfig, getProviderCredentials } from './config';
import { ResendAdapter } from './resend';
import { SmtpAdapter } from './smtp';
import {
  COMMUNICATION_PROVIDERS,
  type CommunicationAdapter,
  type CommunicationProvider,
} from './types';

export type CommunicationRegistry = AdapterRegistry<CommunicationProvider, CommunicationAdapter>;
export type CommunicationFactories = Record<CommunicationProvider, () => CommunicationAdapter>;

/**
 * Les fabriques réelles : trois adapters adossés à la base, qui déchiffrent leurs credentials au
 * moment de l'envoi. Le paquet les possède — un produit n'a pas à savoir comment on parle à Brevo.
 *
 * Elles sont exportées pour être COMPOSÉES, pas appelées : c'est ce qu'un test remplace pour
 * exercer le chemin d'envoi sans réseau.
 */
export const defaultCommunicationFactories: CommunicationFactories = {
  resend: () =>
    new ResendAdapter({
      getCredentials: () => getProviderCredentials('resend'),
      getConfig: () => getProviderConfig('resend'),
    }),
  brevo: () =>
    new BrevoAdapter({
      getCredentials: () => getProviderCredentials('brevo'),
      getConfig: () => getProviderConfig('brevo'),
    }),
  smtp: () =>
    new SmtpAdapter({
      getCredentials: () => getProviderCredentials('smtp'),
      getConfig: () => getProviderConfig('smtp'),
    }),
};

/**
 * Un registre de providers, construit par celui qui l'utilisera.
 *
 * Il n'y a plus d'instance de module : c'est tout l'objet du changement. Le singleton précédent
 * n'offrait aucune couture — un test muni de credentials valides appelait la véritable API, et
 * seule l'absence de provider configuré dans la base de test protégeait le dépôt. Une propriété de
 * la donnée, pas de l'architecture.
 */
export function createCommunicationRegistry(
  factories: CommunicationFactories = defaultCommunicationFactories,
): CommunicationRegistry {
  return createAdapterRegistry<CommunicationProvider, CommunicationAdapter>(
    COMMUNICATION_PROVIDERS,
    factories,
  );
}
