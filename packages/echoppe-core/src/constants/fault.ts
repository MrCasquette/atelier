import type { EchoppeFault, EchoppeResource } from './fault-resources';

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

export const insufficientStock = (available: number, requested: number): EchoppeFault => ({
  code: 'insufficient_stock',
  available,
  requested,
});

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

export const ownerOnly = (action: string): EchoppeFault => ({ code: 'owner_only', action });

export const forbiddenResource = (resource: EchoppeResource): EchoppeFault => ({
  code: 'forbidden_resource',
  resource,
});

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
