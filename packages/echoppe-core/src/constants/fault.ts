import type { UndelegatableReason } from '@repo/shared';
import type { EchoppeFault, EchoppeRank, EchoppeResource } from './fault-resources';

// Constructeurs de fautes d'Échoppe (ADR-0050).
//
// C'est ici, et nulle part ailleurs, que le vocabulaire se ferme. Le socle déclare la FORME d'une
// faute, paramétrée par sa ressource ; ces fonctions l'instancient sur `EchoppeResource` — en
// entrée, donc une faute de frappe échoue à la compilation, ET en sortie, donc ce qui lit une faute
// peut énumérer ses ressources au lieu de recevoir une chaîne ouverte. C'est exactement ce que la
// fermeture devait acheter, sans que le socle ait à connaître le commerce.
//
// Aucun texte n'est produit ici. Chaque surface tient son catalogue `code → message` : l'admin nomme
// la ressource, la boutique reste générique, la CLI affiche la faute brute.
//
// Ces constructeurs prolongent `notFound(entity)` de `lib/response.ts`, qui visait déjà le même but
// — un corps 404 uniforme — mais en produisant une phrase. Ils en gardent l'intention et lui
// retirent la prose.

export const notFound = (resource: EchoppeResource): EchoppeFault => ({
  code: 'not_found',
  resource,
});

export const alreadyExists = (resource: EchoppeResource, field: string): EchoppeFault => ({
  code: 'already_exists',
  resource,
  field,
});

export const inUse = (resource: EchoppeResource, usedBy: EchoppeResource): EchoppeFault => ({
  code: 'in_use',
  resource,
  usedBy,
});

export const invalidState = (
  resource: EchoppeResource,
  current: string,
  expected: string,
): EchoppeFault => ({ code: 'invalid_state', resource, current, expected });

export const insufficientStock = (
  variant: string,
  available: number,
  requested: number,
): EchoppeFault => ({ code: 'insufficient_stock', variant, available, requested });

export const unauthenticated = (): EchoppeFault => ({ code: 'unauthenticated' });

export const invalidCredentials = (): EchoppeFault => ({ code: 'invalid_credentials' });

export const invalidToken = (): EchoppeFault => ({ code: 'invalid_token' });

/**
 * `resource` est ici une chaîne libre, et non `EchoppeResource` : le RBAC a son propre vocabulaire
 * (`ProtectedResource`, ADR-0038), qui inclut l'espace ouvert `entity:<nom>` — inconnu à la
 * compilation par nature, puisque c'est le dev qui déclare ses entités.
 */
export const permissionDenied = (action: string, resource: string): EchoppeFault => ({
  code: 'permission_denied',
  action,
  resource,
});

export const protectedSubject = (resource: EchoppeResource): EchoppeFault => ({
  code: 'protected_subject',
  resource,
});

export const selfActionForbidden = (action: string): EchoppeFault => ({
  code: 'self_action_forbidden',
  action,
});

export const selfOnly = (action: string): EchoppeFault => ({ code: 'self_only', action });

/**
 * `requires` est le seuil exigé, pas le rang de l'appelant : la faute dit ce qu'il aurait fallu
 * détenir, jamais ce que l'appelant est. Remplace `ownerOnly`, qui ne savait nommer qu'une hauteur
 * alors que les gardes en testent deux — `isTheOwner` et `isFirstRank`.
 */
export const rankReserved = (
  action: string,
  requires: EchoppeRank,
  grants?: string[],
): EchoppeFault => ({ code: 'rank_reserved', action, requires, ...(grants && { grants }) });

/**
 * Chaque droit refusé porte SON prédicat. `@repo/auth` les évaluait déjà séparément mais aplatissait
 * le verdict en chaînes, dont l'une rédigeait sa raison en français — une phrase dans un opérande,
 * intraduisible par la surface qui la reçoit.
 */
export const undelegatableGrants = (
  grants: { grant: string; reason: UndelegatableReason }[],
): EchoppeFault => ({ code: 'undelegatable_grants', grants });

export const forbiddenResource = (resource: EchoppeResource): EchoppeFault => ({
  code: 'forbidden_resource',
  resource,
});

/** `field` nomme l'URL refusée, jamais la raison — la fusion est une propriété de sécurité. */
export const redirectUrlRejected = (field: string): EchoppeFault => ({
  code: 'redirect_url_rejected',
  field,
});

/** `field` est l'identifiant du champ ; son libellé appartient au marchand et ne voyage pas. */
export const personalizationRejected = (
  field: string,
  reason: 'unknown' | 'required' | 'too_long',
): EchoppeFault => ({ code: 'personalization_rejected', field, reason });

export const configurationMissing = (target: string): EchoppeFault => ({
  code: 'configuration_missing',
  target,
});

export const requiredDataMissing = (field: string): EchoppeFault => ({
  code: 'required_data_missing',
  field,
});

/** `details` reste une LISTE : joindre est une décision de langue, donc de la surface qui rend. */
export const validationFailed = (details: string[]): EchoppeFault => ({
  code: 'validation_failed',
  details,
});

export const unknownReferenceTargets = (targets: string[]): EchoppeFault => ({
  code: 'unknown_reference_targets',
  targets,
});

export const unknownScopes = (scopes: string[]): EchoppeFault => ({
  code: 'unknown_scopes',
  scopes,
});

export const externalOperationFailed = (operation: string): EchoppeFault => ({
  code: 'external_operation_failed',
  operation,
});
