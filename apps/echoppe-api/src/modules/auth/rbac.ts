import type { Action, Resource } from '@echoppe/core';
import { db, eq, permission, role } from '@echoppe/core';
import { Elysia } from 'elysia';
import { resolveApiKey } from '../api-key/service';
import {
  CUSTOMER_COOKIE_NAME,
  getCustomerSessionFromToken,
  type SessionCustomer,
} from './customer-session';
import {
  createPrincipalRegistry,
  type PermissionSet,
  type Principal,
  type PrincipalRequest,
} from './principal';
import { COOKIE_NAME, getSessionFromToken, type SessionRole, type SessionUser } from './session';

export type { PermissionSet };

// Identité qu'un principal d'Échoppe projette dans le contexte des routes. Les trois champs sont
// toujours présents, à `null` près : c'est ce qui permet à `checkPermission` de n'avoir aucune
// branche par type de principal.
export type EchoppeIdentity = {
  currentUser: SessionUser | null;
  currentRole: SessionRole | null;
  currentCustomer: SessionCustomer | null;
};

export type EchoppePrincipal = Principal<EchoppeIdentity>;

const ANONYMOUS: EchoppeIdentity = {
  currentUser: null,
  currentRole: null,
  currentCustomer: null,
};

// Cache des permissions par rôle (en mémoire)
const permissionCache = new Map<string, Map<string, PermissionSet>>();
const cacheTimestamps = new Map<string, number>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache des identifiants de rôles système, résolus par leur `key` immuable.
const systemRoleIds = new Map<string, string | null>();

async function getPermissionsForRole(roleId: string): Promise<Map<string, PermissionSet>> {
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
async function getPermissionsForRoleKey(key: string): Promise<Map<string, PermissionSet>> {
  let roleId = systemRoleIds.get(key);
  if (roleId === undefined) {
    const [systemRole] = await db.select().from(role).where(eq(role.key, key));
    roleId = systemRole?.id ?? null;
    systemRoleIds.set(key, roleId);
  }
  if (!roleId) return new Map();
  return getPermissionsForRole(roleId);
}

// ── Principaux d'Échoppe ──────────────────────────────────────────────────────────────────────
// L'ordre d'enregistrement est l'ordre d'essai : la clé machine d'abord (en-tête explicite), puis
// les sessions, l'anonyme en dernier recours. Prisme enregistrera les mêmes moins `customer`.

const principals = createPrincipalRegistry<EchoppeIdentity>();

principals.register({
  type: 'apikey',
  async resolve({ authHeader }) {
    const apiKeyPrincipal = await resolveApiKey(authHeader);
    if (!apiKeyPrincipal) return null;
    return {
      type: 'apikey',
      permissions: apiKeyPrincipal.permissions,
      // Jamais de bypass owner : ce n'est pas un humain. Et pas de « soi » à filtrer — les
      // permissions viennent des scopes de la clé, pas d'un compte.
      bypass: false,
      privileged: true,
      hasSubject: false,
      identity: ANONYMOUS,
    };
  },
});

principals.register({
  type: 'admin',
  // Seul résolveur habilité au bypass : le propriétaire de l'installation est un humain de
  // l'administration, et rien d'autre ne l'est.
  mayBypass: true,
  async resolve({ cookie }) {
    const token = cookie[COOKIE_NAME]?.value;
    if (!token) return null;

    const session = await getSessionFromToken(token);
    if (!session.isAuthenticated || !session.currentUser || !session.currentRole) return null;

    return {
      type: 'admin',
      permissions: await getPermissionsForRole(session.currentRole.id),
      bypass: session.currentUser.isOwner,
      privileged: true,
      hasSubject: true,
      identity: {
        currentUser: session.currentUser,
        currentRole: session.currentRole,
        currentCustomer: null,
      },
    };
  },
});

principals.register({
  type: 'customer',
  async resolve({ cookie }) {
    const token = cookie[CUSTOMER_COOKIE_NAME]?.value;
    if (!token) return null;

    const session = await getCustomerSessionFromToken(token);
    if (!session.isAuthenticated || !session.currentCustomer) return null;

    return {
      type: 'customer',
      permissions: await getPermissionsForRoleKey('customer'),
      bypass: false,
      privileged: false,
      hasSubject: true,
      identity: {
        currentUser: null,
        currentRole: null,
        currentCustomer: session.currentCustomer,
      },
    };
  },
});

principals.registerFallback({
  type: 'public',
  async resolve() {
    return {
      type: 'public',
      permissions: await getPermissionsForRoleKey('public'),
      bypass: false,
      privileged: false,
      hasSubject: false,
      identity: ANONYMOUS,
    };
  },
});

// Fonction utilitaire pour vérifier une permission
export function hasPermission(
  permissions: Map<string, PermissionSet>,
  resource: Resource,
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

export function isSelfOnly(permissions: Map<string, PermissionSet>, resource: Resource): boolean {
  const perm = permissions.get(resource);
  return perm?.selfOnly ?? false;
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

/**
 * Vrai si la requête provient d'un principal privilégié (session admin ou clé d'API
 * machine). Sert aux routes publiques dont la VISIBILITÉ dépend de l'appelant : un
 * anonyme ne voit que le contenu public (ex. `isVisible`), l'admin voit tout — sans
 * dupliquer l'endpoint quand seule la visibilité des lignes diffère.
 */
export async function isPrivilegedRequest(
  cookie: Record<string, { value?: string }>,
  authHeader?: string,
): Promise<boolean> {
  const principal = await getPrincipal(cookie, authHeader);
  return principal.privileged;
}

/**
 * Résout le principal de la requête via le registre.
 */
export async function getPrincipal(
  cookie: Record<string, { value?: string }>,
  authHeader?: string,
): Promise<EchoppePrincipal> {
  const request: PrincipalRequest = { cookie, authHeader };
  return principals.resolve(request);
}

/**
 * Vérifie si le principal a la permission demandée.
 * Le propriétaire bypasse toutes les vérifications.
 */
export function checkPermission(
  principal: EchoppePrincipal,
  resource: Resource,
  action: Action,
): EchoppeIdentity & { allowed: boolean; selfOnly: boolean } {
  if (principal.bypass) {
    return { allowed: true, selfOnly: false, ...principal.identity };
  }

  return {
    allowed: hasPermission(principal.permissions, resource, action),
    selfOnly: principal.hasSubject && isSelfOnly(principal.permissions, resource),
    ...principal.identity,
  };
}

/**
 * Crée un guard de permission pour une ressource et action.
 * Usage: .use(permissionGuard('product', 'create'))
 *
 * `adminOnly` : restreint aux principaux privilégiés (session admin ou clé d'API
 * machine). Nécessaire quand le rôle Public possède déjà l'action (ex. `product:read`
 * accordé au storefront) mais que l'endpoint doit rester réservé à l'admin — sinon
 * le bit de permission seul laisserait passer un anonyme.
 */
export function permissionGuard(
  resource: Resource,
  action: Action,
  options?: { adminOnly?: boolean },
) {
  return new Elysia({
    name: `permission-${resource}-${action}${options?.adminOnly ? '-admin' : ''}`,
  }).macro({
    permission: {
      async resolve({ cookie, headers, status }) {
        const principal = await getPrincipal(
          cookie as Record<string, { value?: string }>,
          headers.authorization,
        );

        if (options?.adminOnly && !principal.privileged) {
          return status(403, { message: `Permission refusée: ${action} sur ${resource}` });
        }

        const result = checkPermission(principal, resource, action);

        if (!result.allowed) {
          return status(403, { message: `Permission refusée: ${action} sur ${resource}` });
        }

        return {
          currentUser: result.currentUser,
          currentRole: result.currentRole,
          currentCustomer: result.currentCustomer,
          selfOnly: result.selfOnly,
          principal,
        };
      },
    },
  });
}
