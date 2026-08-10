import { db, eq } from '@repo/db';
import type { PermissionSet } from './principal';
import { permission, role } from './schema';

// Lecture des droits en base, et son cache. Séparé des RÈGLES (`permission.ts`), qui sont pures et
// se testent sans connexion — `@repo/db` exige `DATABASE_URL` dès l'import.

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
