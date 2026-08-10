import { db, eq } from '@repo/db';
import type { PermissionSet, Principal } from './principal';
import { permission, role } from './schema';

// Lecture des droits et règles de délégation, sans rien savoir du transport : ni cookie, ni code
// HTTP. Les gardes qui traduisent un refus en 403 sont du produit (ADR-0044).

export type Action = 'create' | 'read' | 'update' | 'delete';

// Cache des permissions par rôle (en mémoire)
const permissionCache = new Map<string, Map<string, PermissionSet>>();
const cacheTimestamps = new Map<string, number>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache des identifiants de rôles système, résolus par leur `key` immuable.
const systemRoleIds = new Map<string, string | null>();

export async function getPermissionsForRole(roleId: string): Promise<Map<string, PermissionSet>> {
  const now = Date.now();
  const cached = permissionCache.get(roleId);
  const timestamp = cacheTimestamps.get(roleId);

  if (cached && timestamp && now - timestamp < CACHE_TTL) {
    return cached;
  }

  const perms = await db.select().from(permission).where(eq(permission.role, roleId));

  const permMap = new Map<string, PermissionSet>();
  for (const p of perms) {
    permMap.set(p.resource, {
      canCreate: p.canCreate,
      canRead: p.canRead,
      canUpdate: p.canUpdate,
      canDelete: p.canDelete,
      selfOnly: p.selfOnly,
    });
  }

  permissionCache.set(roleId, permMap);
  cacheTimestamps.set(roleId, now);

  return permMap;
}

/**
 * Permissions d'un rôle système désigné par sa `key` stable — jamais par son `name`, que
 * l'utilisateur peut renommer depuis l'administration.
 */
export async function getPermissionsForRoleKey(key: string): Promise<Map<string, PermissionSet>> {
  let roleId = systemRoleIds.get(key);
  if (roleId === undefined) {
    const [systemRole] = await db.select().from(role).where(eq(role.key, key));
    roleId = systemRole?.id ?? null;
    systemRoleIds.set(key, roleId);
  }
  if (!roleId) return new Map();
  return getPermissionsForRole(roleId);
}

/**
 * Invalide le cache des permissions
 * Appeler après modification des permissions d'un rôle
 */
export function invalidatePermissionCache(roleId?: string) {
  if (roleId) {
    permissionCache.delete(roleId);
    cacheTimestamps.delete(roleId);
  } else {
    permissionCache.clear();
    cacheTimestamps.clear();
  }
}

/**
 * Invalide le cache des rôles système (résolus par `key`)
 * Appeler si ces rôles sont recréés
 */
export function invalidateSystemRoleCache() {
  systemRoleIds.clear();
}

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
