import { apiKey, asc, db, eq } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { type ApiKeyScope, generateApiKey, isValidScope } from '../plugins/apiKey';
import { permissionGuard } from '../plugins/rbac';
import { successSchema, withCrudErrors } from '../utils/responses';

// Gestion des clés d'API machine (P2b). Protégé par RBAC `api_key` (seedé Owner). La clé en clair
// n'est renvoyée qu'UNE fois, à la création — ensuite seul son hash existe. Voir plugins/apiKey.

// Schéma des scopes : runtime `string` (un `t.Union` de littéraux construit depuis le `string[]`
// runtime `SCOPES` s'effondrerait en `never` côté type client). Via `t.Unsafe<ApiKeyScope>`, le
// contrat CLIENT porte la vraie union littérale (dérivée de RESOURCES), tandis que la validité
// runtime est assurée dans le handler par `isValidScope` → 422. Un seul point de vérité, zéro drift.
const scopeSchema = t.Unsafe<ApiKeyScope>(t.String());
const uuidParam = t.Object({ id: t.String({ format: 'uuid' }) });

const apiKeyListItem = t.Object({
  id: t.String(),
  name: t.String(),
  scopes: t.Array(t.String()),
  lastUsedAt: t.Nullable(t.Date()),
  expiresAt: t.Nullable(t.Date()),
  dateCreated: t.Date(),
});

const apiKeyCreated = t.Object({
  id: t.String(),
  name: t.String(),
  scopes: t.Array(t.String()),
  expiresAt: t.Nullable(t.Date()),
  dateCreated: t.Date(),
  key: t.String({
    description: 'Clé en clair — affichée UNE seule fois. À stocker maintenant (non récupérable).',
  }),
});

const createBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100, description: 'Libellé lisible de la clé.' }),
  scopes: t.Array(scopeSchema, {
    minItems: 1,
    description:
      'Portées accordées (read:<ressource> / write:<ressource>). Validées à la création.',
  }),
  expiresAt: t.Optional(t.Nullable(t.String({ format: 'date-time' }))),
});

export const apiKeyRoutes = new Elysia({ prefix: '/api-keys', detail: { tags: ['API Keys'] } })

  // === READ ===
  .use(permissionGuard('api_key', 'read'))

  .get(
    '/',
    async ({ selfOnly, currentUser }) =>
      // selfOnly (admin non-owner) → seulement ses clés. Owner : bypass → selfOnly false → tout.
      db
        .select({
          id: apiKey.id,
          name: apiKey.name,
          scopes: apiKey.scopes,
          lastUsedAt: apiKey.lastUsedAt,
          expiresAt: apiKey.expiresAt,
          dateCreated: apiKey.dateCreated,
        })
        .from(apiKey)
        .where(selfOnly && currentUser ? eq(apiKey.createdBy, currentUser.id) : undefined)
        .orderBy(asc(apiKey.dateCreated)),
    { permission: true, response: { 200: t.Array(apiKeyListItem) } },
  )

  // === CREATE ===
  .use(permissionGuard('api_key', 'create'))

  .post(
    '/',
    async ({ body, currentUser, status }) => {
      // Frontière : les scopes sont typés `string[]`, on rejette ici tout scope hors vocabulaire.
      const invalid = body.scopes.filter((scope) => !isValidScope(scope));
      if (invalid.length > 0) {
        return status(422, { message: `Portées inconnues : ${invalid.join(', ')}` });
      }

      const { plaintext, hash } = generateApiKey();
      const [created] = await db
        .insert(apiKey)
        .values({
          name: body.name,
          hash,
          scopes: body.scopes,
          createdBy: currentUser?.id ?? null,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        })
        .returning();
      return {
        id: created.id,
        name: created.name,
        scopes: created.scopes,
        expiresAt: created.expiresAt,
        dateCreated: created.dateCreated,
        key: plaintext, // affichée une seule fois
      };
    },
    { permission: true, body: createBody, response: withCrudErrors({ 200: apiKeyCreated }) },
  )

  // === DELETE (révocation) ===
  .use(permissionGuard('api_key', 'delete'))

  .delete(
    '/:id',
    async ({ params, status, selfOnly, currentUser }) => {
      const [existing] = await db
        .select({ id: apiKey.id, createdBy: apiKey.createdBy })
        .from(apiKey)
        .where(eq(apiKey.id, params.id));
      // Ownership : un admin non-owner ne peut révoquer que SES clés. On masque les autres en 404
      // (pas de fuite d'existence). L'Owner bypasse (selfOnly false) → peut tout révoquer.
      if (!existing || (selfOnly && existing.createdBy !== currentUser?.id)) {
        return status(404, { message: 'Clé introuvable' });
      }
      await db.delete(apiKey).where(eq(apiKey.id, params.id));
      return { success: true };
    },
    { permission: true, params: uuidParam, response: withCrudErrors({ 200: successSchema }) },
  );
