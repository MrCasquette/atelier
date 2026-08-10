// @repo/auth — qui es-tu, et qu'as-tu le droit de faire (ADR-0033).
//
// Les DÉFINITIONS de tables ne sont livrées que comme définitions : chaque cœur les inclut dans son
// barrel et donc dans ses migrations (ADR-0025). Le paquet n'expose aucune route ni aucun plugin
// Elysia — les gardes (`authPlugin`, `permissionGuard`) sont du produit, parce qu'elles traduisent
// en codes HTTP (ADR-0044).
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
