import { db } from '@repo/db';
import { decrypt, encrypt } from '@repo/shared';
import { eq } from 'drizzle-orm';
import { shippingProviderConfig } from '../../db/schema/shipping';
import type { ShippingProvider } from './types';
import { isRecord } from '@repo/shared';

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
  [P in ShippingProvider]: (v: unknown) => v is ProviderCredentials[P];
} = {
  colissimo: (v: unknown): v is ColissimoCredentials =>
    isRecord(v) && typeof v.contractNumber === 'string' && typeof v.password === 'string',
  mondialrelay: (v: unknown): v is MondialRelayCredentials =>
    isRecord(v) &&
    typeof v.brandId === 'string' &&
    typeof v.login === 'string' &&
    typeof v.password === 'string',
  sendcloud: (v: unknown): v is SendcloudCredentials =>
    isRecord(v) && typeof v.apiKey === 'string' && typeof v.apiSecret === 'string',
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
    const parsed: unknown = JSON.parse(decrypt(config.credentials));
    return CREDENTIAL_GUARDS[provider](parsed) ? parsed : null;
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
