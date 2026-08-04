import { createHash, randomBytes } from 'node:crypto';
import { apiKey, db, eq, RESOURCE_LIST, type Resource } from '@echoppe/core';
import type { PermissionSet } from './rbac';

// Clés d'API machine (P2b) : auth non-interactive via `Authorization: Bearer eck_…`.
//
// Modèle : une clé porte des SCOPES (`read:<resource>` / `write:<resource>`) choisis à la
// création, ancrés sur `RESOURCE_LIST` (la SSOT du RBAC → aucun vocabulaire parallèle). À la
// résolution, les scopes sont dérivés en `PermissionSet` par ressource, exactement comme les
// permissions d'un rôle → les guards `permissionGuard(...)` existants marchent sans changement.

const KEY_PREFIX = 'eck_';
const BEARER_RE = /^Bearer\s+(eck_[A-Za-z0-9_-]+)$/;

// ── Vocabulaire de scopes (dérivé de RESOURCE_LIST) ───────────────────────────────────────────
// `write` = create + update + delete (composite, façon GitHub read/write). Le détail granulaire
// reste possible via le RBAC des rôles humains ; les clés machine restent volontairement simples.
//
// `api_key` est EXCLU : une clé ne peut jamais être scopée sur les clés (ni gérer d'autres clés,
// ni elle-même). Garanti par construction — sans le scope, une clé n'obtient jamais la permission.
export const SCOPES: string[] = RESOURCE_LIST.filter((resource) => resource !== 'api_key').flatMap(
  (resource) => [`read:${resource}`, `write:${resource}`],
);

// Type littéral du vocabulaire de scopes, dérivé de `Resource` (SSOT RESOURCES) via template
// literal — le pendant compile-time de `SCOPES`. `RESOURCE_LIST` étant un `string[]` runtime, un
// `t.Union` de littéraux s'effondrerait en `never` ; on attache donc CE type au schéma via
// `t.Unsafe<ApiKeyScope>` (cf. api-keys.ts) pour un contrat client précis, sans drift.
type ScopableResource = Exclude<Resource, 'api_key'>;
export type ApiKeyScope = `read:${ScopableResource}` | `write:${ScopableResource}`;

export const isValidScope = (scope: string): scope is ApiKeyScope => SCOPES.includes(scope);

// ── Génération / hachage ──────────────────────────────────────────────────────────────────────
export const hashApiKey = (plaintext: string): string =>
  createHash('sha256').update(plaintext).digest('hex');

export function generateApiKey(): { plaintext: string; hash: string } {
  const plaintext = KEY_PREFIX + randomBytes(32).toString('base64url');
  return { plaintext, hash: hashApiKey(plaintext) };
}

// ── Scopes → permissions RBAC ─────────────────────────────────────────────────────────────────
export function permissionsFromScopes(scopes: string[]): Map<string, PermissionSet> {
  const permissions = new Map<string, PermissionSet>();
  const ensure = (resource: string): PermissionSet => {
    const existing = permissions.get(resource);
    if (existing) return existing;
    const created: PermissionSet = {
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canDelete: false,
      selfOnly: false,
    };
    permissions.set(resource, created);
    return created;
  };

  for (const scope of scopes) {
    const [action, resource] = scope.split(':');
    if (!resource) continue;
    const perm = ensure(resource);
    if (action === 'read') {
      perm.canRead = true;
    } else if (action === 'write') {
      perm.canCreate = true;
      perm.canUpdate = true;
      perm.canDelete = true;
    }
  }
  return permissions;
}

// ── Résolution depuis le header Authorization ─────────────────────────────────────────────────
export interface ApiKeyPrincipal {
  keyId: string;
  scopes: string[];
  permissions: Map<string, PermissionSet>;
}

export async function resolveApiKey(
  authHeader: string | undefined,
): Promise<ApiKeyPrincipal | null> {
  if (!authHeader) return null;
  const match = authHeader.match(BEARER_RE);
  if (!match) return null;

  const hash = hashApiKey(match[1]);
  const [row] = await db.select().from(apiKey).where(eq(apiKey.hash, hash));
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  // Trace d'usage (clés machine = faible volume, un write par appel est acceptable).
  await db.update(apiKey).set({ lastUsedAt: new Date() }).where(eq(apiKey.id, row.id));

  return { keyId: row.id, scopes: row.scopes, permissions: permissionsFromScopes(row.scopes) };
}
