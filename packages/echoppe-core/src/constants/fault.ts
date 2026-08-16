import type { Fault } from '@repo/shared';
import type { EchoppeResource } from './fault-resources';

// Constructeurs de fautes d'Échoppe (ADR-0050).
//
// C'est ici, et nulle part ailleurs, que le vocabulaire se ferme. Le socle déclare la FORME d'une
// faute avec `resource: string` ; ces fonctions imposent `EchoppeResource`, donc une faute de frappe
// échoue à la compilation. C'est exactement ce que la fermeture devait acheter, sans que le socle
// ait à connaître le commerce.
//
// Aucun texte n'est produit ici. Chaque surface tient son catalogue `code → message` : l'admin nomme
// la ressource, la boutique reste générique, la CLI affiche la faute brute.
//
// Ces constructeurs prolongent `notFound(entity)` de `lib/response.ts`, qui visait déjà le même but
// — un corps 404 uniforme — mais en produisant une phrase. Ils en gardent l'intention et lui
// retirent la prose.

export const notFound = (resource: EchoppeResource): Fault => ({ code: 'not_found', resource });

export const alreadyExists = (resource: EchoppeResource, field: string): Fault => ({
  code: 'already_exists',
  resource,
  field,
});

export const inUse = (resource: EchoppeResource, usedBy: EchoppeResource): Fault => ({
  code: 'in_use',
  resource,
  usedBy,
});

export const invalidState = (
  resource: EchoppeResource,
  current: string,
  expected: string,
): Fault => ({ code: 'invalid_state', resource, current, expected });

export const insufficientStock = (available: number, requested: number): Fault => ({
  code: 'insufficient_stock',
  available,
  requested,
});

export const unauthenticated = (): Fault => ({ code: 'unauthenticated' });

export const invalidCredentials = (): Fault => ({ code: 'invalid_credentials' });

export const invalidToken = (): Fault => ({ code: 'invalid_token' });

/**
 * `resource` est ici une chaîne libre, et non `EchoppeResource` : le RBAC a son propre vocabulaire
 * (`ProtectedResource`, ADR-0038), qui inclut l'espace ouvert `entity:<nom>` — inconnu à la
 * compilation par nature, puisque c'est le dev qui déclare ses entités.
 */
export const permissionDenied = (action: string, resource: string): Fault => ({
  code: 'permission_denied',
  action,
  resource,
});

export const protectedSubject = (resource: EchoppeResource): Fault => ({
  code: 'protected_subject',
  resource,
});

export const selfActionForbidden = (action: string): Fault => ({
  code: 'self_action_forbidden',
  action,
});

export const ownerOnly = (action: string): Fault => ({ code: 'owner_only', action });

export const forbiddenResource = (resource: EchoppeResource): Fault => ({
  code: 'forbidden_resource',
  resource,
});

export const configurationMissing = (target: string): Fault => ({
  code: 'configuration_missing',
  target,
});

export const requiredDataMissing = (field: string): Fault => ({
  code: 'required_data_missing',
  field,
});

/** `details` reste une LISTE : joindre est une décision de langue, donc de la surface qui rend. */
export const validationFailed = (details: string[]): Fault => ({
  code: 'validation_failed',
  details,
});

export const unknownReferenceTargets = (targets: string[]): Fault => ({
  code: 'unknown_reference_targets',
  targets,
});

export const unknownScopes = (scopes: string[]): Fault => ({ code: 'unknown_scopes', scopes });

export const externalOperationFailed = (operation: string): Fault => ({
  code: 'external_operation_failed',
  operation,
});
