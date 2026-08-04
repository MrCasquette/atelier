import { db } from '@repo/db';
import { eq } from 'drizzle-orm';
import { paymentProviderConfig } from '../../db/schema/payment';
import { decrypt, encrypt } from '../../utils/crypto';
import type { PaymentProvider } from './types';

export interface StripeCredentials {
  secretKey: string;
  webhookSecret: string;
}

export interface PayPalCredentials {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
  webhookId: string;
}

export type ProviderCredentials = {
  stripe: StripeCredentials;
  paypal: PayPalCredentials;
};

/**
 * Récupère les credentials déchiffrés d'un provider
 */
export async function getProviderCredentials<T extends PaymentProvider>(
  provider: T,
): Promise<ProviderCredentials[T] | null> {
  const [config] = await db
    .select()
    .from(paymentProviderConfig)
    .where(eq(paymentProviderConfig.provider, provider));

  if (!config?.credentials || !config.isEnabled) {
    return null;
  }

  try {
    const decrypted = decrypt(config.credentials);
    return JSON.parse(decrypted) as ProviderCredentials[T];
  } catch {
    console.error(`Failed to decrypt credentials for ${provider}`);
    return null;
  }
}

/**
 * Sauvegarde les credentials chiffrés d'un provider
 */
export async function saveProviderCredentials<T extends PaymentProvider>(
  provider: T,
  credentials: ProviderCredentials[T],
  isEnabled: boolean = true,
): Promise<void> {
  const encrypted = encrypt(JSON.stringify(credentials));

  const [existing] = await db
    .select({ id: paymentProviderConfig.id })
    .from(paymentProviderConfig)
    .where(eq(paymentProviderConfig.provider, provider));

  if (existing) {
    await db
      .update(paymentProviderConfig)
      .set({
        credentials: encrypted,
        isEnabled,
        dateUpdated: new Date(),
      })
      .where(eq(paymentProviderConfig.id, existing.id));
  } else {
    await db.insert(paymentProviderConfig).values({
      provider,
      credentials: encrypted,
      isEnabled,
    });
  }
}

/**
 * Récupère le statut d'un provider (configuré et activé)
 */
export async function getProviderStatus(provider: PaymentProvider): Promise<{
  isConfigured: boolean;
  isEnabled: boolean;
}> {
  const [config] = await db
    .select({
      isEnabled: paymentProviderConfig.isEnabled,
      hasCredentials: paymentProviderConfig.credentials,
    })
    .from(paymentProviderConfig)
    .where(eq(paymentProviderConfig.provider, provider));

  return {
    isConfigured: !!config?.hasCredentials,
    isEnabled: config?.isEnabled ?? false,
  };
}

/**
 * Active/désactive un provider
 */
export async function setProviderEnabled(
  provider: PaymentProvider,
  isEnabled: boolean,
): Promise<void> {
  await db
    .update(paymentProviderConfig)
    .set({ isEnabled, dateUpdated: new Date() })
    .where(eq(paymentProviderConfig.provider, provider));
}
