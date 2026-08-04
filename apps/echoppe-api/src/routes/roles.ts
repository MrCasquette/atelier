import { and, db, eq, permission, RESOURCES, role, sql, user } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { getClientIp, logAudit } from '../lib/audit';
import { invalidatePermissionCache, permissionGuard } from '../plugins/rbac';
import { errorSchema, successSchema, withAuthErrors } from '../utils/responses';

// Schemas
const roleSchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.Nullable(t.String()),
  scope: t.Union([t.Literal('admin'), t.Literal('store')]),
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
  name: t.String(),
  description: t.Nullable(t.String()),
  scope: t.Union([t.Literal('admin'), t.Literal('store')]),
  isSystem: t.Boolean(),
  dateCreated: t.Date(),
  permissions: t.Array(permissionSchema),
});

const roleCreateBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 50 }),
  description: t.Optional(t.Nullable(t.String())),
  scope: t.Union([t.Literal('admin'), t.Literal('store')]),
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

const resourcesSchema = t.Object({
  resources: t.Array(t.String()),
});

export const rolesRoutes = new Elysia({ prefix: '/roles', detail: { tags: ['Roles'] } })
  // GET /roles/resources - List available resources (protected by role:read)
  .use(permissionGuard('role', 'read'))
  .get(
    '/resources',
    () => {
      return { resources: Object.values(RESOURCES) };
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
      // Ordre métier fixe des rôles système (Propriétaire → Administrateur → Client → Public),
      // puis les rôles custom par ordre alphabétique.
      const systemOrder = sql`CASE ${role.name}
        WHEN 'Propriétaire' THEN 0
        WHEN 'Administrateur' THEN 1
        WHEN 'Client' THEN 2
        WHEN 'Public' THEN 3
        ELSE 4 END`;
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
        return status(404, { message: 'Rôle non trouvé' });
      }

      const perms = await db.select().from(permission).where(eq(permission.role, params.id));

      return { ...r, permissions: perms };
    },
    {
      permission: true,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: {
        200: roleWithPermissionsSchema,
        404: errorSchema,
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
        return status(404, { message: 'Rôle non trouvé' });
      }
      if (existing.isSystem) {
        return status(403, { message: 'Les rôles système ne peuvent pas être modifiés' });
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
        403: errorSchema,
        404: errorSchema,
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
        return status(404, { message: 'Rôle non trouvé' });
      }
      if (existing.isSystem) {
        return status(403, { message: 'Les rôles système ne peuvent pas être supprimés' });
      }

      // Vérifier qu'aucun utilisateur n'utilise ce rôle
      const [userWithRole] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.role, params.id))
        .limit(1);

      if (userWithRole) {
        return status(400, { message: 'Ce rôle est utilisé par un ou plusieurs utilisateurs' });
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
        400: errorSchema,
        403: errorSchema,
        404: errorSchema,
      },
    },
  )

  // PUT /roles/:id/permissions - Set all permissions for role (protected by permission:update)
  .use(permissionGuard('permission', 'update'))
  .put(
    '/:id/permissions',
    async ({ params, body, status, currentUser, request }) => {
      const [existing] = await db.select().from(role).where(eq(role.id, params.id));
      if (!existing) {
        return status(404, { message: 'Rôle non trouvé' });
      }

      // Récupérer les permissions verrouillées existantes (on ne les touche pas)
      const lockedPerms = await db
        .select()
        .from(permission)
        .where(and(eq(permission.role, params.id), eq(permission.locked, true)));

      const lockedResources = new Set(lockedPerms.map((p) => p.resource));

      // Supprimer uniquement les permissions NON verrouillées
      await db
        .delete(permission)
        .where(and(eq(permission.role, params.id), eq(permission.locked, false)));

      // Filtrer les permissions soumises pour exclure celles qui sont verrouillées
      const newPermissions = body.permissions.filter((p) => !lockedResources.has(p.resource));

      // Insérer les nouvelles permissions (non verrouillées uniquement)
      if (newPermissions.length > 0) {
        await db.insert(permission).values(
          newPermissions.map((p) => ({
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
        404: errorSchema,
      },
    },
  );
