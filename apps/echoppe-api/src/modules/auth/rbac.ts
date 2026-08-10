import type { Action, ProtectedResource } from '@echoppe/core';
import {
  createPrincipalRegistry,
  getPermissionsForRole,
  getPermissionsForRoleKey,
  getSessionFromToken,
  hasPermission,
  isSelfOnly,
  type PermissionSet,
  type Principal,
  type PrincipalRequest,
  type SessionRole,
  type SessionUser,
} from '@repo/auth';
import { Elysia } from 'elysia';
import { resolveApiKey } from '../api-key/service';
import {
  CUSTOMER_COOKIE_NAME,
  getCustomerSessionFromToken,
  type SessionCustomer,
} from './customer-session';
import { COOKIE_NAME } from './session';

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

// Rangs qui gouvernent, par clé de rôle système. Le propriétaire n'y figure pas : il est reconnu
// par son `bypass`, qui ne dépend d'aucun rôle. `key` est immuable et porté par le code (ADR-0038) ;
// `name` est de l'affichage et ne doit jamais servir ici.
const FIRST_RANK_ROLE_KEYS = new Set(['admin']);

/**
 * Le premier rang : propriétaire et administrateur.
 *
 * **Retirer un droit est un acte de gouvernance, pas un acte de domaine.** Accorder est additif et
 * se borne naturellement à ce qu'on détient ; retirer est destructeur, et son rayon d'action n'est
 * pas borné par la portée de celui qui retire — il désactive le travail des autres. Le rang est
 * donc le bon critère, pas la possession.
 *
 * Conséquence assumée : un administrateur peut retirer un droit qu'il ne détient pas lui-même. Le
 * rang l'autorise, la portée n'entre pas en compte.
 *
 * Une clé d'API machine n'a pas de rôle → jamais de premier rang, donc jamais de révocation. Un
 * rôle créé depuis l'administration a `key === null` → jamais de premier rang non plus ; un rang
 * sur mesure est un sujet à part, remis à plus tard.
 */
export function isFirstRank(principal: EchoppePrincipal): boolean {
  // Propriétaire de l'installation.
  if (principal.bypass) return true;

  const key = principal.identity.currentRole?.key;
  return key !== null && key !== undefined && FIRST_RANK_ROLE_KEYS.has(key);
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
  resource: ProtectedResource,
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
/**
 * Garde d'une ressource d'ENTITÉ, dont le nom n'est connu qu'à la requête.
 *
 * `permissionGuard` fige sa ressource à la déclaration de la route, ce qui ne peut pas marcher ici :
 * la route est générique — une seule pour toutes les entités — et c'est un choix imposé par le
 * contrat figé (ADR-0027). La ressource est donc dérivée du paramètre `:name`, à chaque requête.
 *
 * Rien n'est matérialisé pour autant : `entity:article` n'existe nulle part en base tant qu'aucun
 * rôle ne le détient. Une entité déclarée est refusée à tout le monde par défaut, ce qui est le bon
 * défaut — masquer une entité, c'est ne pas accorder `canRead` (ADR-0028, résolu depuis).
 */
export function entityPermissionGuard(action: Action) {
  return new Elysia({ name: `permission-entity-${action}` }).macro({
    entityPermission: {
      async resolve({ cookie, headers, params, status }) {
        const name =
          params && typeof params === 'object' && 'name' in params ? String(params.name) : '';

        const principal = await getPrincipal(
          cookie as Record<string, { value?: string }>,
          headers.authorization,
        );

        // Écrire dans une entité est un acte d'administration : le rôle Public peut détenir
        // `canRead` pour servir le front, il ne doit pas pour autant pouvoir écrire.
        if (!principal.privileged) {
          return status(403, { message: `Permission refusée: ${action} sur entity:${name}` });
        }

        const result = checkPermission(principal, `entity:${name}`, action);
        if (!result.allowed) {
          return status(403, { message: `Permission refusée: ${action} sur entity:${name}` });
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

export function permissionGuard(
  resource: ProtectedResource,
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
