import { describe, expect, it } from 'bun:test';
import type { CredentialStore } from '@repo/adapters';
import type { PayPalCredentials } from './config';
import { PayPalAdapter } from './paypal';

// Verrou audit2 #5 : l'intention `capture`/`cancelOrRefund` est portée par l'adapter. PayPal encaisse
// dès l'approbation → `capture` est un no-op de succès (finalisation gérée par l'adapter, pas par
// l'appelant). Testable sans réseau grâce à l'injection du store (#4).
const stubStore = (creds: PayPalCredentials | null): CredentialStore<PayPalCredentials> => ({
  get: () => Promise.resolve(creds),
});

const validCreds: PayPalCredentials = {
  clientId: 'id',
  clientSecret: 'secret',
  mode: 'sandbox',
  webhookId: 'wh',
};

describe('PayPalAdapter — intention capture/cancelOrRefund', () => {
  it('capture est un no-op de succès (déjà encaissé à l’approbation)', async () => {
    const adapter = new PayPalAdapter(stubStore(validCreds));
    expect(await adapter.capture('tx_123')).toEqual({ success: true });
  });

  it('isConfigured reflète le store injecté', async () => {
    expect(await new PayPalAdapter(stubStore(null)).isConfigured()).toBe(false);
    expect(await new PayPalAdapter(stubStore(validCreds)).isConfigured()).toBe(true);
  });
});
