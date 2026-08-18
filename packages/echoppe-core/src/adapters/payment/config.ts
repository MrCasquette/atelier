import { db } from '@repo/db';
import { decrypt, encrypt } from '@repo/shared';
import { eq } from 'drizzle-orm';
import { paymentProviderConfig } from '../../db/schema/payment';
import type { PaymentProvider } from './types';
import { isRecord } from '@repo/shared';

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
 * Ce qu'on accepte de relire dans la base, par provider.
 *
 * Des credentials déchiffrés sont du JSON qu'on n'a pas sous la main au moment de le lire : la
 * colonne peut avoir été écrite par une version antérieure, restaurée d'une sauvegarde, ou
 * corrompue. L'assertion qui tenait ce rôle ne vérifiait rien — elle repoussait la panne jusqu'au
 * premier appel, où elle ressort en erreur de provider incompréhensible.
 *
 * Le type mappé rend la table exhaustive — un provider ajouté sans son guard ne compile plus — et
 * il est annoté plutôt que `satisfies` : c'est ce qui relie `CREDENTIAL_GUARDS[provider]` au type
 * de retour indexé, là où `satisfies` n'aurait laissé qu'une union des formes.
 */
const CREDENTIAL_GUARDS: {
  [P in PaymentProvider]: (v: unknown) => v is ProviderCredentials[P];
} = {
  stripe: (v: unknown): v is StripeCredentials =>
    isRecord(v) && typeof v.secretKey === 'string' && typeof v.webhookSecret === 'string',
  paypal: (v: unknown): v is PayPalCredentials =>
    isRecord(v) &&
    typeof v.clientId === 'string' &&
    typeof v.clientSecret === 'string' &&
    (v.mode === 'sandbox' || v.mode === 'live') &&
    typeof v.webhookId === 'string',
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
    const parsed: unknown = JSON.parse(decrypt(config.credentials));
    return CREDENTIAL_GUARDS[provider](parsed) ? parsed : null;
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
