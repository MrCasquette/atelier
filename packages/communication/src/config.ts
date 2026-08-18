import { db } from '@repo/db';
import { decrypt, encrypt, isRecord } from '@repo/shared';
import { eq } from 'drizzle-orm';
import { communicationProviderConfig } from './schema';
import type { CommunicationConfig, CommunicationProvider } from './types';

export interface ResendCredentials {
  apiKey: string;
}

export interface BrevoCredentials {
  apiKey: string;
}

export interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export type ProviderCredentials = {
  resend: ResendCredentials;
  brevo: BrevoCredentials;
  smtp: SmtpCredentials;
};

/**
 * Ce qu'on accepte de relire dans la base, par provider.
 *
 * Des credentials déchiffrés sont du JSON qu'on n'a pas sous la main au moment de le lire : la
 * colonne peut avoir été écrite par une version antérieure, restaurée d'une sauvegarde, ou
 * corrompue. L'assertion qui tenait ce rôle ne vérifiait rien — elle repoussait simplement la
 * panne jusqu'au premier envoi, où elle ressort en erreur de provider incompréhensible.
 *
 * Le type mappé rend la table exhaustive — un provider ajouté sans son guard ne compile plus — et
 * il est annoté plutôt que `satisfies` : c'est ce qui relie `CREDENTIAL_GUARDS[provider]` au type
 * de retour indexé, là où `satisfies` n'aurait laissé qu'une union des trois formes.
 */
const CREDENTIAL_GUARDS: {
  [P in CommunicationProvider]: (v: unknown) => v is ProviderCredentials[P];
} = {
  resend: (v: unknown): v is ResendCredentials => isRecord(v) && typeof v.apiKey === 'string',
  brevo: (v: unknown): v is BrevoCredentials => isRecord(v) && typeof v.apiKey === 'string',
  smtp: (v: unknown): v is SmtpCredentials =>
    isRecord(v) &&
    typeof v.host === 'string' &&
    typeof v.port === 'number' &&
    typeof v.secure === 'boolean' &&
    typeof v.user === 'string' &&
    typeof v.pass === 'string',
};

/**
 * Récupère les credentials déchiffrés d'un provider
 */
export async function getProviderCredentials<T extends CommunicationProvider>(
  provider: T,
): Promise<ProviderCredentials[T] | null> {
  const [config] = await db
    .select()
    .from(communicationProviderConfig)
    .where(eq(communicationProviderConfig.provider, provider));

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
 * Récupère la configuration d'envoi (from, replyTo)
 */
export async function getProviderConfig(
  provider: CommunicationProvider,
): Promise<CommunicationConfig | null> {
  const [config] = await db
    .select({
      fromEmail: communicationProviderConfig.fromEmail,
      fromName: communicationProviderConfig.fromName,
      replyTo: communicationProviderConfig.replyTo,
    })
    .from(communicationProviderConfig)
    .where(eq(communicationProviderConfig.provider, provider));

  if (!config?.fromEmail || !config?.fromName) {
    return null;
  }

  return {
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    replyTo: config.replyTo ?? undefined,
  };
}

/**
 * Sauvegarde les credentials chiffrés d'un provider
 */
export async function saveProviderCredentials<T extends CommunicationProvider>(
  provider: T,
  credentials: ProviderCredentials[T],
  config: CommunicationConfig,
  isEnabled: boolean = true,
): Promise<void> {
  const encrypted = encrypt(JSON.stringify(credentials));

  const [existing] = await db
    .select({ id: communicationProviderConfig.id })
    .from(communicationProviderConfig)
    .where(eq(communicationProviderConfig.provider, provider));

  if (existing) {
    await db
      .update(communicationProviderConfig)
      .set({
        credentials: encrypted,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        replyTo: config.replyTo,
        isEnabled,
        dateUpdated: new Date(),
      })
      .where(eq(communicationProviderConfig.id, existing.id));
  } else {
    await db.insert(communicationProviderConfig).values({
      provider,
      credentials: encrypted,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      replyTo: config.replyTo,
      isEnabled,
    });
  }
}

/**
 * Récupère le statut d'un provider (configuré et activé)
 */
export async function getProviderStatus(provider: CommunicationProvider): Promise<{
  isConfigured: boolean;
  isEnabled: boolean;
}> {
  const [config] = await db
    .select({
      isEnabled: communicationProviderConfig.isEnabled,
      hasCredentials: communicationProviderConfig.credentials,
    })
    .from(communicationProviderConfig)
    .where(eq(communicationProviderConfig.provider, provider));

  return {
    isConfigured: !!config?.hasCredentials,
    isEnabled: config?.isEnabled ?? false,
  };
}

/**
 * Active/désactive un provider
 */
export async function setProviderEnabled(
  provider: CommunicationProvider,
  isEnabled: boolean,
): Promise<void> {
  await db
    .update(communicationProviderConfig)
    .set({ isEnabled, dateUpdated: new Date() })
    .where(eq(communicationProviderConfig.provider, provider));
}

/**
 * Récupère tous les providers configurés
 */
export async function getAllProvidersStatus(): Promise<
  Array<{
    provider: CommunicationProvider;
    isConfigured: boolean;
    isEnabled: boolean;
  }>
> {
  const configs = await db.select().from(communicationProviderConfig);

  const providers: CommunicationProvider[] = ['resend', 'brevo', 'smtp'];

  return providers.map((provider) => {
    const config = configs.find((c) => c.provider === provider);
    return {
      provider,
      isConfigured: !!config?.credentials,
      isEnabled: config?.isEnabled ?? false,
    };
  });
}
