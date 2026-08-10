import type { PermissionSet, Principal } from './principal';

// Les RÈGLES de droits : qui peut quoi, qui peut déléguer quoi. Pures — aucune base, aucun
// transport. La lecture des droits en base et son cache vivent dans `permission-cache.ts` : les
// séparer garde ces règles testables sans connexion, et elles sont ce qu'il y a de plus important
// à tester.
//
// Les gardes qui traduisent un refus en 403 sont du produit (ADR-0044).

export type Action = 'create' | 'read' | 'update' | 'delete';

// `resource` est une chaîne et non une union fermée : l'espace des ressources s'ouvre aux entités
// déclarées (ADR-0038). C'est le produit qui garde une union à SA frontière — `permissionGuard`
// prend un `Resource` — pendant que le socle raisonne sur des noms.
export function hasPermission(
  permissions: Map<string, PermissionSet>,
  resource: string,
  action: Action,
): boolean {
  const perm = permissions.get(resource);
  if (!perm) return false;

  switch (action) {
    case 'create':
      return perm.canCreate;
    case 'read':
      return perm.canRead;
    case 'update':
      return perm.canUpdate;
    case 'delete':
      return perm.canDelete;
  }
}

export function isSelfOnly(permissions: Map<string, PermissionSet>, resource: string): boolean {
  const perm = permissions.get(resource);
  return perm?.selfOnly ?? false;
}

// Un droit tel qu'on demande à l'accorder à un rôle.
export type PermissionGrant = {
  resource: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  selfOnly?: boolean;
};

const GRANTABLE_ACTIONS = [
  ['create', 'canCreate'],
  ['read', 'canRead'],
  ['update', 'canUpdate'],
  ['delete', 'canDelete'],
] as const;

/**
 * Délégation (ADR-0038) : **on ne peut accorder que ce qu'on détient**, action par action.
 *
 * Sans cette règle, quiconque a `permission:update` peut s'attribuer n'importe quel droit via son
 * propre rôle — le drapeau `locked` ne protège que les lignes qu'on a pensé à verrouiller, pas le
 * principe. L'alternative écartée par l'ADR, une portée d'administration par catégories, laissait
 * justement passer cette élévation ; la délégation la rend structurellement impossible.
 *
 * Renvoie les droits demandés que le principal ne détient pas — vide s'il peut tout accorder.
 * Rendre la liste plutôt qu'un booléen permet de dire à l'appelant CE QUI est refusé.
 */
export function undelegatableGrants(
  principal: Principal<unknown>,
  grants: PermissionGrant[],
): string[] {
  // Le propriétaire de l'installation court-circuite, comme partout ailleurs.
  if (principal.bypass) return [];

  const refused: string[] = [];

  for (const grant of grants) {
    const held = principal.permissions.get(grant.resource);

    for (const [action, flag] of GRANTABLE_ACTIONS) {
      if (grant[flag] && !held?.[flag]) {
        refused.push(`${grant.resource}:${action}`);
      }
    }

    // `selfOnly` borne un droit aux lignes dont on est le sujet. L'accorder SANS cette borne quand
    // on ne le détient qu'avec, c'est accorder plus large que ce qu'on a — même interdit, autre
    // dimension. L'ADR ne l'explicitait pas ; c'est la lecture fidèle de la règle.
    const grantsAnything = GRANTABLE_ACTIONS.some(([, flag]) => grant[flag]);
    if (grantsAnything && held?.selfOnly && grant.selfOnly !== true) {
      refused.push(`${grant.resource}:selfOnly`);
    }
  }

  return refused;
}

// Ce qu'un scope de clé d'API recouvre. `write` est COMPOSITE, façon GitHub : create + update +
// delete. Le détail granulaire reste au RBAC des rôles humains ; les clés machine restent simples.
const SCOPE_WRITE_FLAGS = ['canCreate', 'canUpdate', 'canDelete'] as const;

/**
 * Une clé d'API est une DÉLÉGATION D'AUTORITÉ : la règle d'`undelegatableGrants` s'y applique
 * telle quelle (ADR-0038, amendement du 2026-08-10).
 *
 * Sans elle, `api_key:create` est un droit universel déguisé — qui le détient se forge une clé
 * portant n'importe quel scope, y compris ce qu'il ne peut pas faire lui-même. La validation
 * existante ne vérifiait que le VOCABULAIRE : « ce scope existe-t-il », jamais « l'as-tu ».
 *
 * Renvoie les scopes refusés. Vide si l'émetteur peut tout déléguer.
 */
export function undelegatableScopes(principal: Principal<unknown>, scopes: string[]): string[] {
  // Le propriétaire de l'installation court-circuite, comme partout ailleurs.
  if (principal.bypass) return [];

  const refused: string[] = [];

  for (const scope of scopes) {
    // Découpe sur le PREMIER `:` seulement : une ressource peut en contenir (`write:entity:article`).
    const separator = scope.indexOf(':');
    const action = scope.slice(0, separator);
    const resource = scope.slice(separator + 1);
    const held = principal.permissions.get(resource);

    if (!held) {
      refused.push(scope);
      continue;
    }

    const covered =
      action === 'read' ? held.canRead : SCOPE_WRITE_FLAGS.every((flag) => held[flag]);
    if (!covered) {
      refused.push(scope);
      continue;
    }

    // `selfOnly` borne un droit aux lignes dont on est le sujet. Une clé machine n'a pas de sujet
    // (`hasSubject: false`), donc elle ne PEUT PAS porter cette borne : lui déléguer un droit qu'on
    // ne détient que borné le rendrait illimité entre ses mains. Refusé, faute de pouvoir le
    // restreindre.
    if (held.selfOnly) {
      refused.push(scope);
    }
  }

  return refused;
}

/**
 * Y a-t-il révocation ? `PUT /roles/:id/permissions` remplace l'ensemble des droits : tout ce qui
 * n'est pas soumis est supprimé. Une soumission peut donc retirer sans en avoir l'air.
 *
 * Renvoie les droits que la soumission ferait disparaître — vide si elle ne fait qu'ajouter.
 *
 * `current` ne doit contenir que les lignes NON verrouillées : une ligne `locked` n'est jamais
 * supprimée, elle ne peut donc pas être révoquée.
 */
export function revokedByGrants(
  current: PermissionGrant[],
  submitted: PermissionGrant[],
): string[] {
  const revoked: string[] = [];
  const next = new Map(submitted.map((grant) => [grant.resource, grant]));

  for (const existing of current) {
    const after = next.get(existing.resource);

    for (const [action, flag] of GRANTABLE_ACTIONS) {
      if (existing[flag] && !(after?.[flag] ?? false)) {
        revoked.push(`${existing.resource}:${action}`);
      }
    }

    // Poser `selfOnly` sur un droit qui ne l'avait pas retire de la portée sans retirer d'action :
    // c'est une révocation, même si aucun bit CRUD ne bouge.
    if (!existing.selfOnly && (after?.selfOnly ?? false)) {
      revoked.push(`${existing.resource}:selfOnly`);
    }
  }

  return revoked;
}
