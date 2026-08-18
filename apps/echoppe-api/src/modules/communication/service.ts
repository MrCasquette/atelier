import type {
  BrevoCredentials,
  CommunicationConfig,
  ResendCredentials,
  SendResult,
  SmtpCredentials,
} from '@repo/communication';
import {
  COMMUNICATION_PROVIDERS,
  type CommunicationService,
  getProviderStatus,
  saveProviderCredentials,
} from '@repo/communication';
import { isEncryptionConfigured } from '@repo/shared';
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
      ...(await getProviderStatus(id)),
      encryptionReady,
    })),
  );
}

/**
 * Enregistre les identifiants chiffrés d'un fournisseur. Écrit pour les trois fournisseurs à la
 * fois : ils ne diffèrent que par la forme de leurs identifiants, que le controller a déjà validée.
 */
export async function saveProvider(
  mail: CommunicationService,
  provider: ProviderId,
  credentials: ProviderCredentials,
  config: CommunicationConfig,
  isEnabled: boolean,
): Promise<SaveProviderOutcome> {
  if (!isEncryptionConfigured()) return { outcome: 'encryption-missing' };

  await saveProviderCredentials(provider, credentials, config, isEnabled);
  mail.reset();

  return { outcome: 'saved' };
}

const TEST_SUBJECT = 'Test de configuration email - Échoppe';

/** Vérifie la connexion puis envoie un message de test, tracé dans le journal comme tel. */
export async function sendTestEmail(
  mail: CommunicationService,
  provider: ProviderId,
  to: string,
): Promise<TestEmailOutcome> {
  const adapter = mail.adapter(provider);

  if (!(await adapter.isConfigured())) return { outcome: 'not-configured' };
  if (!(await adapter.verify())) return { outcome: 'unreachable' };

  // Par le service, comme tout envoi : il consigne. Écrire la ligne ici dupliquait ses colonnes et
  // sa traduction du statut — et `isTest` voyage dans les données, qui SONT le `metadata` du
  // journal.
  const result = await mail.sendVia(provider, {
    to,
    subject: TEST_SUBJECT,
    template: 'welcome',
    data: {
      customerName: 'Administrateur',
      shopName: 'Votre Boutique Échoppe',
      shopUrl: '#',
      isTest: true,
    },
  });

  return { outcome: 'sent', result };
}
