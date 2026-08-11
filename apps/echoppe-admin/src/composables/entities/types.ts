// Types des entités déclarées, DÉRIVÉS du contrat Eden — jamais réécrits. La forme d'une entité
// dépend de l'installation : elle ne peut venir que du serveur.
import type { api } from '@/lib/api';
import type { ApiData } from '@/types/api';

/** Une entité déclarée que l'appelant a le droit de lire, et les actions qu'il détient dessus. */
export type GrantedEntity = ApiData<
  ReturnType<typeof api.content.entities.mine.get>
>['entities'][number];

export type EntityAction = GrantedEntity['actions'][number];

/**
 * Une occurrence, telle que l'API la projette : `id`, `slug` (sauf singleton), les champs déclarés
 * sous le nom que le dev leur a donné, `dateCreated` / `dateUpdated`. Plate, donc — la donnée des
 * champs n'est pas nichée sous une clé `data` en LECTURE, alors qu'elle l'est en écriture.
 */
export type EntityRow = Record<string, unknown>;

/** Colonnes d'identité : présentes sur toute occurrence, jamais éditables comme un champ. */
export const IDENTITY_KEYS = ['id', 'slug', 'dateCreated', 'dateUpdated'] as const;
