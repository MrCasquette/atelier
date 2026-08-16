import { and, db, eq, faults, permission, RESOURCES, role, sql, user } from '@echoppe/core';
import {
  delegatableActions,
  invalidatePermissionCache,
  isSelfOnly,
  revokedByGrants,
  undelegatableGrants,
} from '@repo/auth';
import { entityResourceName, loadEntities } from '@repo/entities';
import { Elysia, t } from 'elysia';
import { faultBody } from '../../lib/fault';
import { successSchema, withAuthErrors } from '../../lib/response';
import { models } from '../../model';
import { getClientIp, logAudit } from '../audit/service';
import { isFirstRank, permissionGuard } from '../auth/rbac';

// Schemas
// Surface d'un rôle : union fermée assumée — c'est le socle qui décide qu'il existe une
// administration et une surface publique, pas le produit (ADR-0037, amendé).
const roleScope = t.Union([t.Literal('admin'), t.Literal('public')]);

// `key` : identifiant stable des rôles système, `null` pour les rôles créés depuis l'administration.
// Exposé en lecture seule — il n'est ni dans `roleCreateBody` ni modifiable.
const roleSchema = t.Object({
  id: t.String(),
  key: t.Nullable(t.String()),
  name: t.String(),
  description: t.Nullable(t.String()),
  scope: roleScope,
  isSystem: t.Boolean(),
  dateCreated: t.Date(),
});

const permissionSchema = t.Object({
  id: t.String(),
  role: t.String(),
  resource: t.String(),
  canCreate: t.Boolean(),
  canRead: t.Boolean(),
  canUpdate: t.Boolean(),
  canDelete: t.Boolean(),
  selfOnly: t.Boolean(),
  locked: t.Boolean(),
});

const roleWithPermissionsSchema = t.Object({
  id: t.String(),
  key: t.Nullable(t.String()),
  name: t.String(),
  description: t.Nullable(t.String()),
  scope: roleScope,
  isSystem: t.Boolean(),
  dateCreated: t.Date(),
  permissions: t.Array(permissionSchema),
});

const roleCreateBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 50 }),
  description: t.Optional(t.Nullable(t.String())),
  scope: roleScope,
});

const permissionBody = t.Object({
  resource: t.String({ minLength: 1, maxLength: 50 }),
  canCreate: t.Boolean(),
  canRead: t.Boolean(),
  canUpdate: t.Boolean(),
  canDelete: t.Boolean(),
  selfOnly: t.Optional(t.Boolean()),
});

const permissionsUpdateBody = t.Object({
  permissions: t.Array(permissionBody),
});

// Une ressource protégeable, telle que l'écran des rôles doit pouvoir la proposer. Le `label` n'est
// renseigné que là où le serveur est SEUL à le connaître : une entité porte le libellé que le dev
// lui a déclaré, alors que le vocabulaire du framework est traduit par l'administration.
//
// `actions` dit ce que LE DEMANDEUR peut en accorder — pas ce que la ressource permet dans l'absolu.
//
// `selfOnlyRequired` est l'AUTRE dimension de la même règle : qui ne détient un droit que borné à
// ses propres lignes ne peut l'accorder que borné. Sans ce drapeau, l'écran offrait la ressource
// sans la borne, et l'enregistrement la refusait — pire, la colonne « Self only » ne s'affichant
// que pour les rôles publics, il n'y avait aucune case à cocher pour s'y conformer.
const actionSchema = t.Union([
  t.Literal('create'),
  t.Literal('read'),
  t.Literal('update'),
  t.Literal('delete'),
]);

const resourcesSchema = t.Object({
  resources: t.Array(
    t.Object({
      name: t.String(),
      label: t.Nullable(t.String()),
      actions: t.Array(actionSchema),
      selfOnlyRequired: t.Boolean(),
    }),
  ),
});

export const rolesRoutes = new Elysia({ prefix: '/roles', detail: { tags: ['Roles'] } })
  .use(models)
  // GET /roles/resources — ce qui est protégeable, framework ET entités déclarées, BORNÉ à ce que
  // le demandeur peut en accorder.
  //
  // C'est la SEULE liste : l'écran des rôles ne tient pas la sienne, sans quoi une ressource née
  // après lui resterait muette — c'est ce qui est arrivé à `content`, `api_key` et `schema`. Les
  // entités s'y ajoutent au même titre, dérivées du journal comme partout ailleurs (ADR-0038).
  //
  // La borne (#45) applique « on ne peut accorder que ce qu'on détient » AU MOMENT DE PROPOSER, et
  // non plus seulement au moment d'accorder : une case offerte puis refusée à l'enregistrement est
  // un refus qu'on ne comprend qu'après coup. Elle ne retire rien à personne — retirer un droit
  // n'est pas l'accorder, et l'écran resoumet intactes les lignes qu'il n'affiche pas.
  .use(permissionGuard('role', 'read'))
  .get(
    '/resources',
    async ({ principal }) => {
      const entities = Object.values(await loadEntities()).map((declaration) => ({
        name: entityResourceName(declaration.name),
        label: declaration.label as string | null,
      }));
      const framework = Object.values(RESOURCES).map((name) => ({
        name: name as string,
        label: null,
      }));

      const resources = [...framework, ...entities].flatMap(({ name, label }) => {
        const actions = delegatableActions(principal, name);
        if (actions.length === 0) return [];

        // Même prédicat que la règle de délégation (`undelegatableGrants`), pas une reformulation.
        const selfOnlyRequired = isSelfOnly(principal.authority, name);
        return [{ name, label, actions, selfOnlyRequired }];
      });

      return { resources };
    },
    {
      permission: true,
      response: { 200: resourcesSchema },
    },
  )

  // GET /roles - List all roles
  .get(
    '/',
    async () => {
      // Ordre métier fixe des rôles système, désignés par leur `key` immuable : les renommer
      // depuis l'administration ne doit pas les renvoyer au fond de la liste.
      const systemOrder = sql`CASE ${role.key}
        WHEN 'admin' THEN 0
        WHEN 'customer' THEN 1
        WHEN 'public' THEN 2
        ELSE 3 END`;
      return db.select().from(role).orderBy(systemOrder, role.name);
    },
    {
      permission: true,
      response: { 200: t.Array(roleSchema) },
    },
  )

  // GET /roles/:id - Get role with permissions
  .get(
    '/:id',
    async ({ params, status }) => {
      const [r] = await db.select().from(role).where(eq(role.id, params.id));
      if (!r) {
        return status(404, faultBody(faults.notFound('role')));
      }

      const perms = await db.select().from(permission).where(eq(permission.role, params.id));

      return { ...r, permissions: perms };
    },
    {
      permission: true,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: {
        200: roleWithPermissionsSchema,
        404: 'ErrorResponse',
      },
    },
  )

  // POST /roles - Create role (protected by role:create)
  .use(permissionGuard('role', 'create'))
  .post(
    '/',
    async ({ body, currentUser, request }) => {
      const [created] = await db
        .insert(role)
        .values({
          name: body.name,
          description: body.description ?? null,
          scope: body.scope,
          isSystem: false,
        })
        .returning();

      logAudit({
        userId: currentUser?.id,
        action: 'role.create',
        entityType: 'role',
        entityId: created.id,
        data: { name: created.name, scope: created.scope },
        ipAddress: getClientIp(request.headers),
      });

      return created;
    },
    {
      permission: true,
      body: roleCreateBody,
      response: withAuthErrors({ 200: roleSchema }),
    },
  )

  // PUT /roles/:id - Update role (protected by role:update)
  .use(permissionGuard('role', 'update'))
  .put(
    '/:id',
    async ({ params, body, status, currentUser, request }) => {
      const [existing] = await db.select().from(role).where(eq(role.id, params.id));
      if (!existing) {
        return status(404, faultBody(faults.notFound('role')));
      }
      if (existing.isSystem) {
        return status(403, faultBody(faults.protectedSubject('role')));
      }

      const [updated] = await db
        .update(role)
        .set({
          name: body.name,
          description: body.description ?? null,
          scope: body.scope,
        })
        .where(eq(role.id, params.id))
        .returning();

      logAudit({
        userId: currentUser?.id,
        action: 'role.update',
        entityType: 'role',
        entityId: params.id,
        data: { name: updated.name, scope: updated.scope },
        ipAddress: getClientIp(request.headers),
      });

      return updated;
    },
    {
      permission: true,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      body: roleCreateBody,
      response: {
        200: roleSchema,
        403: 'ErrorResponse',
        404: 'ErrorResponse',
      },
    },
  )

  // DELETE /roles/:id - Delete role (protected by role:delete)
  .use(permissionGuard('role', 'delete'))
  .delete(
    '/:id',
    async ({ params, status, currentUser, request }) => {
      const [existing] = await db.select().from(role).where(eq(role.id, params.id));
      if (!existing) {
        return status(404, faultBody(faults.notFound('role')));
      }
      if (existing.isSystem) {
        return status(403, faultBody(faults.protectedSubject('role')));
      }

      // Vérifier qu'aucun utilisateur n'utilise ce rôle
      const [userWithRole] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.role, params.id))
        .limit(1);

      if (userWithRole) {
        return status(400, faultBody(faults.inUse('role', 'user')));
      }

      // Supprimer les permissions puis le rôle
      await db.delete(permission).where(eq(permission.role, params.id));
      await db.delete(role).where(eq(role.id, params.id));

      logAudit({
        userId: currentUser?.id,
        action: 'role.delete',
        entityType: 'role',
        entityId: params.id,
        data: { name: existing.name },
        ipAddress: getClientIp(request.headers),
      });

      invalidatePermissionCache(params.id);
      return { success: true };
    },
    {
      permission: true,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: {
        200: successSchema,
        400: 'ErrorResponse',
        403: 'ErrorResponse',
        404: 'ErrorResponse',
      },
    },
  )

  // PUT /roles/:id/permissions - Set all permissions for role (protected by permission:update)
  .use(permissionGuard('permission', 'update'))
  .put(
    '/:id/permissions',
    async ({ params, body, status, currentUser, request, principal }) => {
      const [existing] = await db.select().from(role).where(eq(role.id, params.id));
      if (!existing) {
        return status(404, faultBody(faults.notFound('role')));
      }

      const currentPerms = await db.select().from(permission).where(eq(permission.role, params.id));

      // Les lignes verrouillées ne bougent jamais — ni accordées, ni retirées.
      const lockedResources = new Set(currentPerms.filter((p) => p.locked).map((p) => p.resource));
      const unlocked = currentPerms.filter((p) => !p.locked);

      // Délégation (ADR-0038) : on ne peut accorder que ce qu'on détient. Retirer, en revanche,
      // est un acte de gouvernance réservé au premier rang — l'ensemble étant remplacé d'un bloc,
      // une soumission réduite supprime le reste, ce qui permettait de vider un rôle qu'on
      // n'administre pas.
      //
      // La vérification porte sur ce qui sera RÉELLEMENT appliqué, donc hors lignes verrouillées :
      // celles-ci ne bougent pas, et les resoumettre telles quelles — ce que fait l'écran d'édition
      // des rôles — ne doit pas passer pour une tentative d'accorder quoi que ce soit.
      const submitted = body.permissions.filter((p) => !lockedResources.has(p.resource));

      const ungrantable = undelegatableGrants(principal, submitted);
      if (ungrantable.length > 0) {
        // Chaque droit refusé porte son prédicat : « non détenu » ne se corrige pas comme
        // « tient au rang ». `@repo/auth` les distinguait déjà, mais rédigeait la seconde raison
        // en français dans la liste.
        return status(403, faultBody(faults.undelegatableGrants(ungrantable)));
      }

      const revoked = revokedByGrants(unlocked, body.permissions);
      if (revoked.length > 0 && !isFirstRank(principal)) {
        // Un SEUIL, pas une possession : le rang autorise à retirer un droit qu'on ne détient pas
        // soi-même (ADR-0047). `revoked` voyage quand même, et c'est le seul site où il le fait :
        // la route REMPLACE l'ensemble des droits, donc ce qui disparaît n'est pas ce que
        // l'appelant a soumis — il ne peut pas le déduire de sa propre requête.
        return status(403, faultBody(faults.rankReserved('revoke', 'first_rank', revoked)));
      }

      // Supprimer uniquement les permissions NON verrouillées
      await db
        .delete(permission)
        .where(and(eq(permission.role, params.id), eq(permission.locked, false)));

      // Insérer les nouvelles permissions (non verrouillées uniquement)
      if (submitted.length > 0) {
        await db.insert(permission).values(
          submitted.map((p) => ({
            role: params.id,
            resource: p.resource,
            canCreate: p.canCreate,
            canRead: p.canRead,
            canUpdate: p.canUpdate,
            canDelete: p.canDelete,
            selfOnly: p.selfOnly ?? false,
            locked: false,
          })),
        );
      }

      logAudit({
        userId: currentUser?.id,
        action: 'permission.update',
        entityType: 'role',
        entityId: params.id,
        data: { permissionsCount: body.permissions.length },
        ipAddress: getClientIp(request.headers),
      });

      invalidatePermissionCache(params.id);

      const perms = await db.select().from(permission).where(eq(permission.role, params.id));
      return { permissions: perms };
    },
    {
      permission: true,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      body: permissionsUpdateBody,
      response: {
        200: t.Object({ permissions: t.Array(permissionSchema) }),
        403: 'ErrorResponse',
        404: 'ErrorResponse',
      },
    },
  );
