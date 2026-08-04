import { db } from '@repo/db';
import { eq } from 'drizzle-orm';
import { shippingProviderConfig } from '../../db/schema/shipping';
import { decrypt, encrypt } from '../../utils/crypto';
import type { ShippingProvider } from './types';

export interface ColissimoCredentials {
  contractNumber: string;
  password: string;
}

export interface MondialRelayCredentials {
  brandId: string;
  login: string;
  password: string;
}

export interface SendcloudCredentials {
  apiKey: string;
  apiSecret: string;
}

export type ProviderCredentials = {
  colissimo: ColissimoCredentials;
  mondialrelay: MondialRelayCredentials;
  sendcloud: SendcloudCredentials;
};

/**
 * Récupère les credentials déchiffrés d'un provider shipping
 */
export async function getShippingProviderCredentials<T extends ShippingProvider>(
  provider: T,
): Promise<ProviderCredentials[T] | null> {
  const [config] = await db
    .select()
    .from(shippingProviderConfig)
    .where(eq(shippingProviderConfig.provider, provider));

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
 * Sauvegarde les credentials chiffrés d'un provider shipping
 */
export async function saveShippingProviderCredentials<T extends ShippingProvider>(
  provider: T,
  credentials: ProviderCredentials[T],
  isEnabled: boolean = true,
): Promise<void> {
  const encrypted = encrypt(JSON.stringify(credentials));

  const [existing] = await db
    .select({ id: shippingProviderConfig.id })
    .from(shippingProviderConfig)
    .where(eq(shippingProviderConfig.provider, provider));

  if (existing) {
    await db
      .update(shippingProviderConfig)
      .set({
        credentials: encrypted,
        isEnabled,
        dateUpdated: new Date(),
      })
      .where(eq(shippingProviderConfig.id, existing.id));
  } else {
    await db.insert(shippingProviderConfig).values({
      provider,
      credentials: encrypted,
      isEnabled,
    });
  }
}

/**
 * Récupère le statut d'un provider shipping (configuré et activé)
 */
export async function getShippingProviderStatus(provider: ShippingProvider): Promise<{
  isConfigured: boolean;
  isEnabled: boolean;
}> {
  const [config] = await db
    .select({
      isEnabled: shippingProviderConfig.isEnabled,
      hasCredentials: shippingProviderConfig.credentials,
    })
    .from(shippingProviderConfig)
    .where(eq(shippingProviderConfig.provider, provider));

  return {
    isConfigured: !!config?.hasCredentials,
    isEnabled: config?.isEnabled ?? false,
  };
}

/**
 * Active/désactive un provider shipping
 */
export async function setShippingProviderEnabled(
  provider: ShippingProvider,
  isEnabled: boolean,
): Promise<void> {
  await db
    .update(shippingProviderConfig)
    .set({ isEnabled, dateUpdated: new Date() })
    .where(eq(shippingProviderConfig.provider, provider));
}
