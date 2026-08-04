import type { SQL } from '@echoppe/core';
import { and, auditLog, count, db, desc, eq, gte, isNotNull, lte, user } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { permissionGuard } from '../plugins/rbac';
import { buildListResponse, getPaginationParams, listResponse } from '../utils/pagination';

// Query schema
const auditLogQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 50 })),
  action: t.Optional(t.String()),
  entityType: t.Optional(t.String()),
  userId: t.Optional(t.String({ format: 'uuid' })),
  dateFrom: t.Optional(t.String()),
  dateTo: t.Optional(t.String()),
});

// Response schemas
const auditLogUserSchema = t.Object({
  id: t.String(),
  email: t.String(),
  firstName: t.String(),
  lastName: t.String(),
});

const auditLogItemSchema = t.Object({
  id: t.String(),
  user: t.Nullable(auditLogUserSchema),
  action: t.String(),
  entityType: t.Nullable(t.String()),
  entityId: t.Nullable(t.String()),
  data: t.Nullable(t.Unknown()),
  ipAddress: t.Nullable(t.String()),
  dateCreated: t.Date(),
});

const paginatedAuditLogsSchema = listResponse(auditLogItemSchema);

export const auditLogsRoutes = new Elysia({ prefix: '/audit-logs', detail: { tags: ['Audit'] } })

  // === AUDIT LOG READ ===
  .use(permissionGuard('audit_log', 'read'))

  // GET /audit-logs - Liste paginée avec filtres
  .get(
    '/',
    async ({ query }) => {
      const { page, limit, offset } = getPaginationParams(query);
      const { action, entityType, userId, dateFrom, dateTo } = query;

      const conditions: SQL[] = [];

      // Filter by action (partial match)
      if (action) {
        conditions.push(eq(auditLog.action, action));
      }

      // Filter by entity type
      if (entityType) {
        conditions.push(eq(auditLog.entityType, entityType));
      }

      // Filter by user
      if (userId) {
        conditions.push(eq(auditLog.user, userId));
      }

      // Filter by date range
      if (dateFrom) {
        conditions.push(gte(auditLog.dateCreated, new Date(dateFrom)));
      }
      if (dateTo) {
        // Add 1 day to include the end date fully
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        conditions.push(lte(auditLog.dateCreated, endDate));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [logs, [{ total }]] = await Promise.all([
        db
          .select({
            id: auditLog.id,
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
            },
            action: auditLog.action,
            entityType: auditLog.entityType,
            entityId: auditLog.entityId,
            data: auditLog.data,
            ipAddress: auditLog.ipAddress,
            dateCreated: auditLog.dateCreated,
          })
          .from(auditLog)
          .leftJoin(user, eq(auditLog.user, user.id))
          .where(whereClause)
          .orderBy(desc(auditLog.dateCreated))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count(auditLog.id) })
          .from(auditLog)
          .where(whereClause),
      ]);

      // Transform null user objects (when user was deleted)
      const transformedLogs = logs.map((log) => ({
        ...log,
        user: log.user?.id ? log.user : null,
      }));

      return buildListResponse(transformedLogs, total, page, limit);
    },
    {
      permission: true,
      query: auditLogQuery,
      response: { 200: paginatedAuditLogsSchema },
    },
  )

  // GET /audit-logs/actions - Liste des actions distinctes (pour filtres)
  .get(
    '/actions',
    async () => {
      const actions = await db
        .selectDistinct({ action: auditLog.action })
        .from(auditLog)
        .orderBy(auditLog.action);

      return actions.map((a) => a.action);
    },
    {
      permission: true,
      response: { 200: t.Array(t.String()) },
    },
  )

  // GET /audit-logs/entity-types - Liste des types d'entités distincts (pour filtres)
  .get(
    '/entity-types',
    async () => {
      const types = await db
        .selectDistinct({ entityType: auditLog.entityType })
        .from(auditLog)
        .where(isNotNull(auditLog.entityType));

      return types.filter((t) => t.entityType).map((t) => t.entityType as string);
    },
    {
      permission: true,
      response: { 200: t.Array(t.String()) },
    },
  );
