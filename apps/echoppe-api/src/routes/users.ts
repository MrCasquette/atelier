import { and, count, db, desc, eq, ilike, or, role, session, sql, user } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { getClientIp, logAudit } from '../lib/audit';
import { permissionGuard } from '../plugins/rbac';
import { buildListResponse, listResponse, parseListQuery } from '../utils/pagination';
import { badRequestResponse, successSchema, withCrudErrors } from '../utils/responses';

// Query schemas
const userSearchQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
  search: t.Optional(t.String()),
  role: t.Optional(t.String({ format: 'uuid' })),
  status: t.Optional(t.String()),
  sort: t.Optional(t.String()),
  order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
});

// Body schemas
const userCreateBody = t.Object({
  email: t.String({ format: 'email', maxLength: 255 }),
  password: t.String({ minLength: 6 }),
  firstName: t.String({ minLength: 1, maxLength: 100 }),
  lastName: t.String({ minLength: 1, maxLength: 100 }),
  role: t.String({ format: 'uuid' }),
});

const userUpdateBody = t.Object({
  email: t.Optional(t.String({ format: 'email', maxLength: 255 })),
  password: t.Optional(t.String({ minLength: 6 })),
  firstName: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  lastName: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  role: t.Optional(t.String({ format: 'uuid' })),
});

const statusBody = t.Object({
  isActive: t.Boolean(),
});

// Param schemas
const uuidParam = t.Object({
  id: t.String({ format: 'uuid' }),
});

// Response schemas

const roleSchema = t.Object({
  id: t.String(),
  name: t.String(),
});

const userListItemSchema = t.Object({
  id: t.String(),
  email: t.String(),
  firstName: t.String(),
  lastName: t.String(),
  role: roleSchema,
  isOwner: t.Boolean(),
  isActive: t.Boolean(),
  dateCreated: t.Date(),
  lastLogin: t.Nullable(t.Date()),
});

const paginatedUsersSchema = listResponse(userListItemSchema);

const userDetailSchema = t.Object({
  id: t.String(),
  email: t.String(),
  firstName: t.String(),
  lastName: t.String(),
  role: roleSchema,
  isOwner: t.Boolean(),
  isActive: t.Boolean(),
  dateCreated: t.Date(),
  lastLogin: t.Nullable(t.Date()),
});

const userCreatedSchema = t.Object({
  id: t.String(),
  email: t.String(),
});

export const usersRoutes = new Elysia({ prefix: '/users', detail: { tags: ['Users'] } })

  // === USER READ ===
  .use(permissionGuard('user', 'read'))

  // GET /users - Liste paginée avec filtres
  .get(
    '/',
    async ({ query }) => {
      const { search, status } = query;

      // Défaut (aucun tri explicite) = owner d'abord puis plus récents (multi-colonnes).
      // Filtre role générique ; search full-text + status->isActive restent bespoke.
      const { page, limit, offset, orderBy, filters } = parseListQuery(query, {
        sortable: {
          // `name` = colonne « Utilisateur » de l'UI (tri par nom de famille).
          name: user.lastName,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          dateCreated: user.dateCreated,
          lastLogin: user.lastLogin,
        },
        defaultSort: [desc(user.isOwner), desc(user.dateCreated)],
        filterable: { role: user.role },
      });

      const conditions = [...filters];

      if (search) {
        const searchPattern = `%${search}%`;
        const searchCondition = or(
          ilike(user.email, searchPattern),
          ilike(user.firstName, searchPattern),
          ilike(user.lastName, searchPattern),
        );
        if (searchCondition) conditions.push(searchCondition);
      }

      if (status === 'active') {
        conditions.push(eq(user.isActive, true));
      } else if (status === 'inactive') {
        conditions.push(eq(user.isActive, false));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [users, [{ total }]] = await Promise.all([
        db
          .select({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: {
              id: role.id,
              name: role.name,
            },
            isOwner: user.isOwner,
            isActive: user.isActive,
            dateCreated: user.dateCreated,
            lastLogin: user.lastLogin,
          })
          .from(user)
          .innerJoin(role, eq(user.role, role.id))
          .where(whereClause)
          .orderBy(...orderBy)
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count(user.id) })
          .from(user)
          .where(whereClause),
      ]);

      return buildListResponse(users, total, page, limit);
    },
    {
      permission: true,
      query: userSearchQuery,
      response: { 200: paginatedUsersSchema },
    },
  )

  // GET /users/:id - Détail utilisateur
  .get(
    '/:id',
    async ({ params, status }) => {
      const [userData] = await db
        .select({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: {
            id: role.id,
            name: role.name,
          },
          isOwner: user.isOwner,
          isActive: user.isActive,
          dateCreated: user.dateCreated,
          lastLogin: user.lastLogin,
        })
        .from(user)
        .innerJoin(role, eq(user.role, role.id))
        .where(eq(user.id, params.id));

      if (!userData) {
        return status(404, { message: 'Utilisateur introuvable' });
      }

      return userData;
    },
    {
      permission: true,
      params: uuidParam,
      response: withCrudErrors({ 200: userDetailSchema }),
    },
  )

  // === USER CREATE ===
  .use(permissionGuard('user', 'create'))

  // POST /users - Créer utilisateur
  .post(
    '/',
    async ({ body, status, currentUser, request }) => {
      // Check if email already exists
      const [existing] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, body.email));

      if (existing) {
        return status(400, { message: 'Un utilisateur avec cet email existe déjà' });
      }

      // Check if role exists
      const [roleExists] = await db
        .select({ id: role.id })
        .from(role)
        .where(eq(role.id, body.role));

      if (!roleExists) {
        return status(400, { message: 'Rôle introuvable' });
      }

      // Hash password
      const passwordHash = await Bun.password.hash(body.password);

      // Create user
      const [newUser] = await db
        .insert(user)
        .values({
          email: body.email,
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName,
          role: body.role,
          isOwner: false,
          isActive: true,
        })
        .returning({ id: user.id, email: user.email });

      logAudit({
        userId: currentUser?.id,
        action: 'user.create',
        entityType: 'user',
        entityId: newUser.id,
        data: { email: newUser.email },
        ipAddress: getClientIp(request.headers),
      });

      return newUser;
    },
    {
      permission: true,
      body: userCreateBody,
      response: withCrudErrors({ 200: userCreatedSchema, 400: badRequestResponse }),
    },
  )

  // === USER UPDATE ===
  .use(permissionGuard('user', 'update'))

  // PATCH /users/:id - Modifier utilisateur
  .patch(
    '/:id',
    async ({ params, body, status, currentUser, request }) => {
      const [existing] = await db
        .select({ id: user.id, isOwner: user.isOwner })
        .from(user)
        .where(eq(user.id, params.id));

      if (!existing) {
        return status(404, { message: 'Utilisateur introuvable' });
      }

      // Cannot modify owner (except owner themselves)
      if (existing.isOwner && currentUser?.id !== params.id) {
        return status(403, { message: 'Impossible de modifier le propriétaire' });
      }

      // Check if email already exists (if changing)
      if (body.email) {
        const [emailExists] = await db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.email, body.email), sql`${user.id} != ${params.id}`));

        if (emailExists) {
          return status(400, { message: 'Un utilisateur avec cet email existe déjà' });
        }
      }

      // Check if role exists (if changing)
      if (body.role) {
        const [roleExists] = await db
          .select({ id: role.id })
          .from(role)
          .where(eq(role.id, body.role));

        if (!roleExists) {
          return status(400, { message: 'Rôle introuvable' });
        }
      }

      const updates: Partial<typeof user.$inferInsert> = {};

      if (body.email !== undefined) updates.email = body.email;
      if (body.firstName !== undefined) updates.firstName = body.firstName;
      if (body.lastName !== undefined) updates.lastName = body.lastName;
      if (body.role !== undefined) updates.role = body.role;

      // Hash password if provided
      if (body.password) {
        updates.passwordHash = await Bun.password.hash(body.password);
      }

      if (Object.keys(updates).length > 0) {
        await db.update(user).set(updates).where(eq(user.id, params.id));

        logAudit({
          userId: currentUser?.id,
          action: 'user.update',
          entityType: 'user',
          entityId: params.id,
          data: { fieldsUpdated: Object.keys(updates).filter((k) => k !== 'passwordHash') },
          ipAddress: getClientIp(request.headers),
        });
      }

      return { success: true };
    },
    {
      permission: true,
      params: uuidParam,
      body: userUpdateBody,
      response: withCrudErrors({ 200: successSchema, 400: badRequestResponse }),
    },
  )

  // PATCH /users/:id/status - Activer/Désactiver
  .patch(
    '/:id/status',
    async ({ params, body, status, currentUser }) => {
      const [existing] = await db
        .select({ id: user.id, isOwner: user.isOwner })
        .from(user)
        .where(eq(user.id, params.id));

      if (!existing) {
        return status(404, { message: 'Utilisateur introuvable' });
      }

      // Cannot deactivate owner
      if (existing.isOwner) {
        return status(403, { message: 'Impossible de désactiver le propriétaire' });
      }

      // Cannot deactivate yourself
      if (currentUser?.id === params.id && !body.isActive) {
        return status(403, { message: 'Impossible de vous désactiver vous-même' });
      }

      await db.update(user).set({ isActive: body.isActive }).where(eq(user.id, params.id));

      // If deactivating, invalidate all sessions
      if (!body.isActive) {
        await db.delete(session).where(eq(session.user, params.id));
      }

      return { success: true };
    },
    {
      permission: true,
      params: uuidParam,
      body: statusBody,
      response: withCrudErrors({ 200: successSchema }),
    },
  )

  // === USER DELETE ===
  .use(permissionGuard('user', 'delete'))

  // DELETE /users/:id - Supprimer utilisateur
  .delete(
    '/:id',
    async ({ params, status, currentUser, request }) => {
      const [existing] = await db
        .select({ id: user.id, isOwner: user.isOwner })
        .from(user)
        .where(eq(user.id, params.id));

      if (!existing) {
        return status(404, { message: 'Utilisateur introuvable' });
      }

      // Cannot delete owner
      if (existing.isOwner) {
        return status(403, { message: 'Impossible de supprimer le propriétaire' });
      }

      // Cannot delete yourself
      if (currentUser?.id === params.id) {
        return status(403, { message: 'Impossible de vous supprimer vous-même' });
      }

      // Delete sessions first
      await db.delete(session).where(eq(session.user, params.id));

      // Delete user
      await db.delete(user).where(eq(user.id, params.id));

      logAudit({
        userId: currentUser?.id,
        action: 'user.delete',
        entityType: 'user',
        entityId: params.id,
        ipAddress: getClientIp(request.headers),
      });

      return { success: true };
    },
    {
      permission: true,
      params: uuidParam,
      response: withCrudErrors({ 200: successSchema }),
    },
  );
