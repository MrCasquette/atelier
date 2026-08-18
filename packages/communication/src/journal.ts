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
    async record({ provider, message, result }) {
      await db.insert(communicationLog).values({
        provider,
        channel: 'email',
        template: message.template,
        recipient: message.to,
        subject: message.subject,
        // La traduction du résultat en statut appartient au journal : `bounced`, la troisième
        // valeur, ne viendra jamais d'un envoi mais d'un webhook du provider.
        status: result.success ? 'sent' : 'failed',
        providerMessageId: result.messageId,
        error: result.error,
        metadata: message.data,
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
