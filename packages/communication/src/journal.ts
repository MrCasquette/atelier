import { db } from '@repo/db';
import { getProviderStatus } from './config';
import { communicationLog } from './schema';
import type { CommunicationJournal, CommunicationProvider } from './types';

/**
 * Le journal réel : la table `communication_log`, que ce paquet possède.
 *
 * Il vit dans son propre fichier plutôt que dans le service, pour la même raison que les fabriques
 * d'adapters vivent dans le registre — c'est ce qu'un test remplace. Un journal en mémoire suffit
 * alors à exercer tout le chemin d'envoi sans base.
 */
export function createDbJournal(): CommunicationJournal {
  return {
    async record(entry) {
      await db.insert(communicationLog).values({
        provider: entry.provider,
        channel: 'email',
        template: entry.template,
        recipient: entry.recipient,
        subject: entry.subject,
        status: entry.status,
        providerMessageId: entry.providerMessageId,
        error: entry.error,
        metadata: entry.metadata,
      });
    },
  };
}

/**
 * La disponibilité réelle d'un provider : configuré ET activé, d'après la base.
 *
 * Voisine du journal parce qu'elle a la même nature — une dépendance que le produit branche, et
 * qu'un test remplace par une réponse constante.
 */
export function createDbProviderReadiness(): (provider: CommunicationProvider) => Promise<boolean> {
  return async (provider) => {
    const status = await getProviderStatus(provider);
    return status.isConfigured && status.isEnabled;
  };
}
