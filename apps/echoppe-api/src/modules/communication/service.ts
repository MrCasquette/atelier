import type {
  BrevoCredentials,
  CommunicationConfig,
  ResendCredentials,
  SendResult,
  SmtpCredentials,
} from '@echoppe/core';
import {
  COMMUNICATION_PROVIDERS,
  communicationLog,
  db,
  getCommunicationAdapter,
  getCommunicationProviderStatus,
  isEncryptionConfigured,
  resetCommunicationAdapters,
  saveCommunicationProviderCredentials,
} from '@echoppe/core';
import { providerMeta } from './provider-meta';

// Configuration des fournisseurs d'e-mail, sans rien savoir du transport. Ce module ne sait pas
// envoyer un message métier : l'envoi vit dans @repo/communication, appelé ici pour vérifier une
// connexion et enregistrer des identifiants chiffrés.

type ProviderId = (typeof COMMUNICATION_PROVIDERS)[number];

type ProviderCredentials = ResendCredentials | BrevoCredentials | SmtpCredentials;

export type SaveProviderOutcome =
  | { outcome: 'saved' }
  /** `ENCRYPTION_KEY` absente : on refuse d'écrire des identifiants en clair. */
  | { outcome: 'encryption-missing' };

export type TestEmailOutcome =
  | { outcome: 'sent'; result: SendResult }
  | { outcome: 'not-configured' }
  /** Identifiants présents mais la connexion au fournisseur échoue. */
  | { outcome: 'unreachable' };

/** Les trois fournisseurs, avec leur métadonnée d'affichage et leur état de configuration. */
export async function listProviderStatuses() {
  const encryptionReady = isEncryptionConfigured();

  return Promise.all(
    COMMUNICATION_PROVIDERS.map(async (id) => ({
      id,
      ...providerMeta[id],
      ...(await getCommunicationProviderStatus(id)),
      encryptionReady,
    })),
  );
}

/**
 * Enregistre les identifiants chiffrés d'un fournisseur. Écrit pour les trois fournisseurs à la
 * fois : ils ne diffèrent que par la forme de leurs identifiants, que le controller a déjà validée.
 */
export async function saveProvider(
  provider: ProviderId,
  credentials: ProviderCredentials,
  config: CommunicationConfig,
  isEnabled: boolean,
): Promise<SaveProviderOutcome> {
  if (!isEncryptionConfigured()) return { outcome: 'encryption-missing' };

  await saveCommunicationProviderCredentials(provider, credentials, config, isEnabled);
  resetCommunicationAdapters();

  return { outcome: 'saved' };
}

const TEST_SUBJECT = 'Test de configuration email - Échoppe';

/** Vérifie la connexion puis envoie un message de test, tracé dans le journal comme tel. */
export async function sendTestEmail(provider: ProviderId, to: string): Promise<TestEmailOutcome> {
  const adapter = getCommunicationAdapter(provider);

  if (!(await adapter.isConfigured())) return { outcome: 'not-configured' };
  if (!(await adapter.verify())) return { outcome: 'unreachable' };

  const result = await adapter.send({
    to,
    subject: TEST_SUBJECT,
    template: 'welcome',
    data: {
      customerName: 'Administrateur',
      shopName: 'Votre Boutique Échoppe',
      shopUrl: '#',
    },
  });

  await db.insert(communicationLog).values({
    provider,
    channel: 'email',
    template: 'welcome',
    recipient: to,
    subject: TEST_SUBJECT,
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    error: result.error,
    metadata: { isTest: true },
  });

  return { outcome: 'sent', result };
}
