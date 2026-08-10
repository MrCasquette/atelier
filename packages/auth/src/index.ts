// @repo/auth — qui es-tu, et qu'as-tu le droit de faire (ADR-0033).
//
// Ce paquet ne livre que des DÉFINITIONS de tables ; chaque cœur les inclut dans son barrel et donc
// dans ses migrations (ADR-0025). Il n'expose aucune route ni aucun plugin Elysia : les gardes
// (`authPlugin`, `permissionGuard`) sont du produit, parce qu'elles traduisent en codes HTTP
// (ADR-0044).
export {
  apiKey,
  auditLog,
  permission,
  role,
  roleScopeEnum,
  session,
  user,
} from './schema';
