import { describe, expect, it } from 'bun:test';
import type { CredentialStore } from '@repo/adapters';
import type { StripeCredentials } from './config';
import { StripeAdapter } from './stripe';

// Verrou audit2 #4 (DIP) : l'adapter dépend d'un CredentialStore injecté, donc testable SANS base
// de données ni credentials réels — ce qui était structurellement impossible avant l'injection.
const stubStore = (creds: StripeCredentials | null): CredentialStore<StripeCredentials> => ({
  get: () => Promise.resolve(creds),
});

describe('StripeAdapter — injection du CredentialStore', () => {
  it('isConfigured = false quand le store ne fournit rien', async () => {
    const adapter = new StripeAdapter(stubStore(null));
    expect(await adapter.isConfigured()).toBe(false);
  });

  it('isConfigured = true quand le store fournit des credentials', async () => {
    const adapter = new StripeAdapter(
      stubStore({ secretKey: 'sk_test_x', webhookSecret: 'whsec_x' }),
    );
    expect(await adapter.isConfigured()).toBe(true);
  });

  it('verifyWebhook rejette une signature manquante (adapter responsable de ses headers)', async () => {
    const adapter = new StripeAdapter(
      stubStore({ secretKey: 'sk_test_x', webhookSecret: 'whsec_x' }),
    );
    await expect(adapter.verifyWebhook('{}', {})).rejects.toThrow(/stripe-signature/);
  });
});
