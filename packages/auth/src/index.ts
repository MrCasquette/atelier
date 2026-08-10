// @repo/auth — qui es-tu, et qu'as-tu le droit de faire (ADR-0033).
//
// Les DÉFINITIONS de tables ne sont livrées que comme définitions : chaque cœur les inclut dans son
// barrel et donc dans ses migrations (ADR-0025). Le paquet n'expose aucune route ni aucun plugin
// Elysia — les gardes (`authPlugin`, `permissionGuard`) sont du produit, parce qu'elles traduisent
// en codes HTTP (ADR-0044).

export {
  type Action,
  hasPermission,
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
  createPrincipalRegistry,
  type FallbackPrincipalResolver,
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
