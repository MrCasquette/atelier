export { BrevoAdapter } from './brevo';
export {
  type BrevoCredentials,
  getAllProvidersStatus,
  getProviderConfig,
  getProviderCredentials,
  getProviderStatus,
  type ResendCredentials,
  type SmtpCredentials,
  saveProviderCredentials,
  setProviderEnabled,
} from './config';
export { ResendAdapter } from './resend';
export { SmtpAdapter } from './smtp';
export {
  type EmailLayoutParams,
  emailLayout,
  hasEmailTemplate,
  listEmailTemplates,
  registerEmailTemplate,
  renderTemplate,
} from './templates';
export type {
  CommunicationAdapter,
  CommunicationConfig,
  CommunicationCredentialStore,
  CommunicationProvider,
  EmailMessage,
  EmailStatus,
  EmailTemplate,
  EmailTemplateRenderer,
  SendResult,
} from './types';
export { COMMUNICATION_PROVIDERS, isCommunicationProvider } from './types';

import { createAdapterRegistry } from '@repo/adapters';
import { BrevoAdapter } from './brevo';
import { getProviderConfig, getProviderCredentials, getProviderStatus } from './config';
import { ResendAdapter } from './resend';
import { SmtpAdapter } from './smtp';
import {
  COMMUNICATION_PROVIDERS,
  type CommunicationAdapter,
  type CommunicationProvider,
} from './types';

// Registre déclaratif : store réel (credentials + config d'envoi déchiffrés) injecté par fabrique.
const registry = createAdapterRegistry<CommunicationProvider, CommunicationAdapter>(
  COMMUNICATION_PROVIDERS,
  {
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
  },
);

const isReady = async (provider: CommunicationProvider): Promise<boolean> => {
  const status = await getProviderStatus(provider);
  return status.isConfigured && status.isEnabled;
};

export function getCommunicationAdapter(provider: CommunicationProvider): CommunicationAdapter {
  return registry.get(provider);
}

// Premier provider configuré et activé (ordre déclaré dans COMMUNICATION_PROVIDERS).
export async function getActiveCommunicationAdapter(): Promise<CommunicationAdapter | null> {
  const [first] = await registry.available(isReady);
  return first ? registry.get(first) : null;
}

export function getAvailableCommunicationProviders(): Promise<CommunicationProvider[]> {
  return registry.available(isReady);
}

export function resetCommunicationAdapters(): void {
  registry.reset();
}
