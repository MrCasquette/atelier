// @repo/auth — qui es-tu, et qu'as-tu le droit de faire (ADR-0033).
//
// Ni route, ni plugin Elysia : traduire un refus en code HTTP est du produit. Garder les règles de
// droits séparées de leur lecture en base — sinon elles cessent d'être testables. Voir README.md.

/** Ce que ce paquet possède, nommable dans une faute (ADR-0050). Un produit compose les siennes. */
export type AuthResource = 'user' | 'role' | 'permission' | 'api_key' | 'session';

export {
  type Action,
  delegatableActions,
  holds,
  isSelfOnly,
  type PermissionGrant,
  RANK_BOUND_RESOURCES,
  revokedByGrants,
  undelegatableGrants,
  undelegatableScopes,
} from './permission';
export {
  getPermissionsForRole,
  getPermissionsForRoleKey,
  invalidatePermissionCache,
  invalidateSystemRoleCache,
} from './permission-cache';
export {
  type Authority,
  createPrincipalRegistry,
  type FallbackPrincipalResolver,
  granted,
  type PermissionSet,
  type Principal,
  type PrincipalRegistry,
  type PrincipalRequest,
  type PrincipalResolver,
} from './principal';
export {
  apiKey,
  auditLog,
  permission,
  role,
  roleScopeEnum,
  session,
  user,
  userPasswordToken,
} from './schema';
export {
  type AdminLoginOutcome,
  type AdminSessionRead,
  type AuthContext,
  type AuthenticatedUser,
  authenticateAdmin,
  destroyAdminSession,
  getSessionFromToken,
  readAdminSession,
  SESSION_DURATION_DAYS,
  type SessionOwnerRole,
  type SessionRole,
  type SessionUser,
  type SessionWithMeta,
} from './service';
