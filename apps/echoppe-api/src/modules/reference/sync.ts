import { loadEntities, syncEntityTargets } from '@repo/entities';
import { references } from './targets';

// Le registre de cibles d'Échoppe est peuplé de deux façons, et c'est délibéré :
//   - à l'IMPORT, par le produit — `product`, `collection`, `category`, `page`. Fixes, connues à la
//     compilation, elles ne bougent jamais.
//   - depuis le JOURNAL, pour les entités — déclarées par le dev, donc inconnues avant l'exécution.
//
// La seconde est un miroir, pas une source : la SSOT reste les fichiers du dev (ADR-0046), et c'est
// le même rapport que celui de la ressource RBAC d'une entité (ADR-0038).

/**
 * Aligne les cibles `entity:` sur le journal.
 *
 * À appeler au démarrage — sans quoi une entité déclarée avant le dernier redémarrage cesserait
 * d'être citable — et après chaque push, où la déclaration vient de changer.
 */
export async function syncEntityReferences(): Promise<void> {
  syncEntityTargets(references, await loadEntities());
}
