import { faults, type ProtectedResource, RESOURCES } from '@echoppe/core';
import type { Action } from '@repo/auth';
import {
  type Authority,
  createPrincipalRegistry,
  getPermissionsForRole,
  getPermissionsForRoleKey,
  getSessionFromToken,
  granted,
  holds,
  isSelfOnly,
  type PermissionSet,
  type Principal,
  type PrincipalRequest,
  type SessionRole,
  type SessionUser,
} from '@repo/auth';
import { Elysia } from 'elysia';
import { faultBody } from '../../lib/fault';
import { resolveApiKey } from '../api-key/service';
import {
  CUSTOMER_COOKIE_NAME,
  getCustomerSessionFromToken,
  type SessionCustomer,
} from './customer-session';
import { COOKIE_NAME } from './session';
import { readableCookies } from '../../lib/cookie';

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

// Rangs qui gouvernent, par clé de rôle système. Le propriétaire n'y figure pas : il est reconnu
// par son autorité `total`, qui ne dépend d'aucun rôle. `key` est immuable et porté par le code
// (ADR-0038) ; `name` est de l'affichage et ne doit jamais servir ici.
const FIRST_RANK_ROLE_KEYS = new Set(['admin']);

/**
 * Ce rôle confère-t-il le premier rang ?
 *
 * Le rang ne se déduit PAS des permissions : un rôle sur mesure peut porter exactement les mêmes
 * droits qu'un administrateur sans être du premier rang, et c'est voulu — révoquer, et toucher à un
 * utilisateur du rang, restent hors de sa portée (ADR-0047, décision 4). Le rang tient à `key`,
 * immuable et portée par le code.
 */
export function isFirstRankRoleKey(key: string | null): boolean {
  return key !== null && FIRST_RANK_ROLE_KEYS.has(key);
}

/**
 * Ce que l'Administrateur NE détient pas (ADR-0047).
 *
 * Trois listes courtes contre une trentaine de lignes de seed — et surtout, **ce qui s'énumère est
 * ce qu'on retire**. Toute ressource future lui revient donc par défaut, ce qui est exactement
 * l'écart qui a produit cette décision : `entity:<nom>` naît après le seed, et aucune liste écrite
 * avant ne pouvait le contenir.
 *
 * Vocabulaire du PRODUIT, donc écrit ici et non dans le socle : `payment_config` est du commerce,
 * `communication_config` de l'envoi. Prisme aura les siennes, et `@repo/auth` n'a pas à les
 * connaître — il ne nomme que `schema`, et pour une raison qui lui est propre.
 */
const ADMINISTRATOR: Authority = {
  kind: 'except',
  // Des credentials : les lire, c'est les avoir. Ils restent au propriétaire.
  reserved: new Set<ProtectedResource>([RESOURCES.PAYMENT_CONFIG, RESOURCES.COMMUNICATION_CONFIG]),
  // Un journal d'audit qui se modifie ne vaut rien.
  readOnly: new Set<ProtectedResource>([RESOURCES.AUDIT_LOG]),
  // Chaque administrateur gère SES clés, pas celles des autres.
  ownRowsOnly: new Set<ProtectedResource>([RESOURCES.API_KEY]),
};

/**
 * L'autorité d'une session d'administration.
 *
 * Le propriétaire détient tout. Le premier rang détient tout **moins** ce qui est nommé ci-dessus.
 * Tout autre rôle — y compris `owner` porté par quelqu'un qui n'est pas le propriétaire — n'a que
 * ce que ses lignes accordent.
 */
async function sessionAuthority(user: SessionUser, role: SessionRole): Promise<Authority> {
  if (user.isOwner) return { kind: 'total' };
  if (role.key !== null && FIRST_RANK_ROLE_KEYS.has(role.key)) return ADMINISTRATOR;
  return granted(await getPermissionsForRole(role.id));
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
      // Jamais d'autorité totale : ce n'est pas un humain. Et pas de « soi » à filtrer — les
      // permissions viennent des scopes de la clé, pas d'un compte.
      authority: granted(apiKeyPrincipal.permissions),
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
      authority: await sessionAuthority(session.currentUser, session.currentRole),
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
      authority: granted(await getPermissionsForRoleKey('customer')),
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
      authority: granted(await getPermissionsForRoleKey('public')),
      privileged: false,
      hasSubject: false,
      identity: ANONYMOUS,
    };
  },
});

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
  if (principal.authority.kind === 'total') return true;

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
  cookie: Record<string, { value?: unknown }>,
  authHeader?: string,
): Promise<boolean> {
  const principal = await getPrincipal(cookie, authHeader);
  return principal.privileged;
}

/**
 * Résout le principal de la requête via le registre.
 */
export async function getPrincipal(
  cookie: Record<string, { value?: unknown }>,
  authHeader?: string,
): Promise<EchoppePrincipal> {
  const request: PrincipalRequest = { cookie: readableCookies(cookie), authHeader };
  return principals.resolve(request);
}

/**
 * Vérifie si le principal a la permission demandée.
 *
 * Aucune branche par type de principal, et depuis ADR-0047 aucune dérogation pour le propriétaire
 * non plus : son autorité `total` répond `true` comme les autres répondent ce qu'elles savent.
 */
export function checkPermission(
  principal: EchoppePrincipal,
  resource: ProtectedResource,
  action: Action,
): EchoppeIdentity & { allowed: boolean; selfOnly: boolean } {
  return {
    allowed: holds(principal.authority, resource, action),
    selfOnly: principal.hasSubject && isSelfOnly(principal.authority, resource),
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
 * rôle ne le détient. Une entité déclarée est refusée à tout rôle ORDINAIRE par défaut — masquer
 * une entité, c'est ne pas accorder `canRead` (ADR-0028, résolu depuis). Le premier rang, lui, la
 * détient sans qu'aucune ligne ne le dise : son autorité est une règle (ADR-0047).
 */
export function entityPermissionGuard(action: Action) {
  return new Elysia({ name: `permission-entity-${action}` }).macro({
    entityPermission: {
      async resolve({ cookie, headers, params, status }) {
        const name =
          params && typeof params === 'object' && 'name' in params ? String(params.name) : '';

        const principal = await getPrincipal(
          cookie,
          headers.authorization,
        );

        // Écrire dans une entité est un acte d'administration : le rôle Public peut détenir
        // `canRead` pour servir le front, il ne doit pas pour autant pouvoir écrire.
        if (!principal.privileged) {
          return status(403, faultBody(faults.permissionDenied(action, `entity:${name}`)));
        }

        const result = checkPermission(principal, `entity:${name}`, action);
        if (!result.allowed) {
          return status(403, faultBody(faults.permissionDenied(action, `entity:${name}`)));
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
          cookie,
          headers.authorization,
        );

        // `privileged` et `!allowed` rendent la MÊME faute, et c'était déjà le cas du message
        // qu'ils remplacent : pour l'appelant, « tu n'as pas ce droit » dans les deux cas. Le
        // seuil `privileged` n'est pas un rang — il ne dit pas qui gouverne, mais qui est de
        // confiance —, donc `rank_reserved` ne lui conviendrait pas.
        if (options?.adminOnly && !principal.privileged) {
          return status(403, faultBody(faults.permissionDenied(action, resource)));
        }

        const result = checkPermission(principal, resource, action);

        if (!result.allowed) {
          return status(403, faultBody(faults.permissionDenied(action, resource)));
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
