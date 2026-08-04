import { randomUUID } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
  and,
  asc,
  count,
  db,
  desc,
  eq,
  folder,
  isNull,
  like,
  media,
  or,
  type SQL,
} from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { getClientIp, logAudit } from '../lib/audit';
import { UPLOAD_DIR } from '../lib/config';
import { permissionGuard } from '../plugins/rbac';
import {
  buildListResponse,
  DEFAULT_LIMIT,
  getPaginationParams,
  listResponse,
  MAX_LIMIT,
} from '../utils/pagination';
import { errorSchema, successSchema, withAuthErrors } from '../utils/responses';

// Schema de réponse pour les médias
const mediaSchema = t.Object({
  id: t.String(),
  folder: t.Nullable(t.String()),
  filenameDisk: t.String(),
  filenameOriginal: t.String(),
  title: t.Nullable(t.String()),
  description: t.Nullable(t.String()),
  alt: t.Nullable(t.String()),
  mimeType: t.String(),
  size: t.Number(),
  width: t.Nullable(t.Number()),
  height: t.Nullable(t.Number()),
  dateCreated: t.Date(),
});

// Schema de réponse pour les dossiers
const folderSchema = t.Object({
  id: t.String(),
  parent: t.Nullable(t.String()),
  name: t.String(),
  sortOrder: t.Number(),
});

// Ensure upload directory exists
await mkdir(UPLOAD_DIR, { recursive: true });

const uuidParam = t.Object({
  id: t.String({ format: 'uuid' }),
});

const folderBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  parent: t.Optional(t.Union([t.String({ format: 'uuid' }), t.Null()])),
});

const mediaUpdate = t.Object({
  title: t.Optional(t.String({ maxLength: 255 })),
  description: t.Optional(t.String()),
  alt: t.Optional(t.String({ maxLength: 255 })),
  folder: t.Optional(t.Union([t.String({ format: 'uuid' }), t.Null()])),
});

const mediaQuery = t.Object({
  folder: t.Optional(t.String({ format: 'uuid' })),
  search: t.Optional(t.String()),
  sort: t.Optional(t.String()),
  order: t.Optional(t.String()),
  all: t.Optional(t.String()),
  type: t.Optional(
    t.Union([t.Literal('images'), t.Literal('pdf'), t.Literal('documents'), t.Literal('all')]),
  ),
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT })),
});

const uploadBody = t.Object({
  file: t.Union([t.File(), t.Array(t.File())]),
  folder: t.Optional(t.String({ format: 'uuid' })),
  folderName: t.Optional(t.String({ maxLength: 100 })),
});

const batchMoveBody = t.Object({
  ids: t.Array(t.String({ format: 'uuid' })),
  folder: t.Union([t.String({ format: 'uuid' }), t.Null()]),
});

const batchDeleteBody = t.Object({
  ids: t.Array(t.String({ format: 'uuid' })),
});

// Schemas génériques
const batchResultSchema = t.Object({ moved: t.Array(t.String()), count: t.Number() });
const batchDeleteResultSchema = t.Object({ deleted: t.Array(t.String()), count: t.Number() });

export const mediaRoutes = new Elysia({ prefix: '/media', detail: { tags: ['Media'] } })

  // === ALL ROUTES ARE PROTECTED (Admin only) ===

  // === FOLDERS - READ ===
  .use(permissionGuard('media', 'read'))

  // GET /media/folders - List all folders (flat list for tree building)
  .get(
    '/folders',
    async () => {
      const folders = await db.select().from(folder).orderBy(asc(folder.name));
      return folders;
    },
    { permission: true, response: t.Array(folderSchema) },
  )

  // === FOLDERS - CREATE ===
  .use(permissionGuard('media', 'create'))

  // POST /media/folders - Create folder
  .post(
    '/folders',
    async ({ body, currentUser, request }) => {
      const [created] = await db
        .insert(folder)
        .values({
          name: body.name,
          parent: body.parent || null,
        })
        .returning();

      logAudit({
        userId: currentUser?.id,
        action: 'folder.create',
        entityType: 'folder',
        entityId: created.id,
        data: { name: created.name },
        ipAddress: getClientIp(request.headers),
      });

      return created;
    },
    { permission: true, body: folderBody, response: withAuthErrors({ 200: folderSchema }) },
  )

  // === FOLDERS - UPDATE ===
  .use(permissionGuard('media', 'update'))

  // PUT /media/folders/:id - Update folder
  .put(
    '/folders/:id',
    async ({ params, body, status }) => {
      const [updated] = await db
        .update(folder)
        .set({ name: body.name, parent: body.parent || null })
        .where(eq(folder.id, params.id))
        .returning();

      if (!updated) return status(404, { message: 'Dossier non trouvé' });
      return updated;
    },
    {
      permission: true,
      params: uuidParam,
      body: folderBody,
      response: { 200: folderSchema, 404: errorSchema },
    },
  )

  // === FOLDERS - DELETE ===
  .use(permissionGuard('media', 'delete'))

  // DELETE /media/folders/:id - Delete folder
  .delete(
    '/folders/:id',
    async ({ params, status, currentUser, request }) => {
      // Move child folders to parent
      const [currentFolder] = await db.select().from(folder).where(eq(folder.id, params.id));
      if (currentFolder) {
        await db
          .update(folder)
          .set({ parent: currentFolder.parent })
          .where(eq(folder.parent, params.id));
        await db
          .update(media)
          .set({ folder: currentFolder.parent })
          .where(eq(media.folder, params.id));
      }

      const [deleted] = await db.delete(folder).where(eq(folder.id, params.id)).returning();

      if (!deleted) return status(404, { message: 'Dossier non trouvé' });

      logAudit({
        userId: currentUser?.id,
        action: 'folder.delete',
        entityType: 'folder',
        entityId: params.id,
        data: { name: deleted.name },
        ipAddress: getClientIp(request.headers),
      });

      return { success: true };
    },
    {
      permission: true,
      params: uuidParam,
      response: { 200: successSchema, 404: errorSchema },
    },
  )

  // === MEDIA - READ ===
  .use(permissionGuard('media', 'read'))

  // GET /media - List media with search, filter, sort, pagination
  .get(
    '/',
    async ({ query }) => {
      const { folder: folderId, search, sort, order, all, type } = query;
      const { page, limit, offset } = getPaginationParams(query);

      // Build where conditions
      const conditions: SQL[] = [];

      if (all !== 'true') {
        if (folderId) {
          conditions.push(eq(media.folder, folderId));
        } else {
          conditions.push(isNull(media.folder));
        }
      }

      if (search) {
        const searchPattern = `%${search}%`;
        const searchCondition = or(
          like(media.title, searchPattern),
          like(media.filenameOriginal, searchPattern),
        );
        if (searchCondition) conditions.push(searchCondition);
      }

      // Filter by type
      if (type && type !== 'all') {
        if (type === 'images') {
          conditions.push(like(media.mimeType, 'image/%'));
        } else if (type === 'pdf') {
          conditions.push(eq(media.mimeType, 'application/pdf'));
        } else if (type === 'documents') {
          // Documents: PDF, Word, Excel, Text, etc.
          const docCondition = or(
            eq(media.mimeType, 'application/pdf'),
            like(media.mimeType, 'application/msword%'),
            like(media.mimeType, 'application/vnd.openxmlformats%'),
            like(media.mimeType, 'application/vnd.ms-%'),
            like(media.mimeType, 'text/%'),
          );
          if (docCondition) conditions.push(docCondition);
        }
      }

      // Sort
      const sortField =
        sort === 'name' ? media.filenameOriginal : sort === 'size' ? media.size : media.dateCreated;
      const sortOrder = order === 'asc' ? asc(sortField) : desc(sortField);

      // Build where clause
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, [{ total }]] = await Promise.all([
        whereClause
          ? db
              .select()
              .from(media)
              .where(whereClause)
              .orderBy(sortOrder)
              .limit(limit)
              .offset(offset)
          : db.select().from(media).orderBy(sortOrder).limit(limit).offset(offset),
        whereClause
          ? db
              .select({ total: count(media.id) })
              .from(media)
              .where(whereClause)
          : db.select({ total: count(media.id) }).from(media),
      ]);

      return buildListResponse(items, total, page, limit);
    },
    { permission: true, query: mediaQuery, response: listResponse(mediaSchema) },
  )

  // GET /media/:id - Get single media
  .get(
    '/:id',
    async ({ params, status }) => {
      const [item] = await db.select().from(media).where(eq(media.id, params.id));

      if (!item) return status(404, { message: 'Média non trouvé' });
      return item;
    },
    {
      permission: true,
      params: uuidParam,
      response: {
        200: mediaSchema,
        404: t.Object({ message: t.String() }),
      },
    },
  )

  // === MEDIA - CREATE ===
  .use(permissionGuard('media', 'create'))

  // POST /media/upload - Upload file(s)
  .post(
    '/upload',
    async ({ body, currentUser, request }) => {
      const files = Array.isArray(body.file) ? body.file : [body.file];
      let folderId = body.folder || null;

      // Si folderName est fourni et pas de folder, créer/trouver le dossier
      if (body.folderName && !folderId) {
        let [targetFolder] = await db
          .select({ id: folder.id })
          .from(folder)
          .where(eq(folder.name, body.folderName));

        if (!targetFolder) {
          [targetFolder] = await db
            .insert(folder)
            .values({ name: body.folderName })
            .returning({ id: folder.id });
        }

        folderId = targetFolder.id;
      }

      const results = [];

      for (const file of files) {
        const ext = file.name.split('.').pop() || '';
        const filenameDisk = `${randomUUID()}.${ext}`;
        const filePath = join(UPLOAD_DIR, filenameDisk);

        // Write file to disk
        await Bun.write(filePath, file);

        // Get image dimensions if applicable
        const width: number | null = null;
        const height: number | null = null;

        // Insert into database
        const [created] = await db
          .insert(media)
          .values({
            folder: folderId,
            filenameDisk,
            filenameOriginal: file.name,
            title: file.name.replace(/\.[^/.]+$/, ''),
            mimeType: file.type,
            size: file.size,
            width,
            height,
          })
          .returning();

        results.push(created);

        logAudit({
          userId: currentUser?.id,
          action: 'media.upload',
          entityType: 'media',
          entityId: created.id,
          data: { filename: created.filenameOriginal, mimeType: created.mimeType },
          ipAddress: getClientIp(request.headers),
        });
      }

      return results.length === 1 ? results[0] : results;
    },
    {
      permission: true,
      body: uploadBody,
      response: withAuthErrors({ 200: t.Union([mediaSchema, t.Array(mediaSchema)]) }),
    },
  )

  // === MEDIA - UPDATE ===
  .use(permissionGuard('media', 'update'))

  // PUT /media/:id - Update media metadata
  .put(
    '/:id',
    async ({ params, body, status }) => {
      const updateData: Record<string, unknown> = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.alt !== undefined) updateData.alt = body.alt;
      if (body.folder !== undefined) updateData.folder = body.folder;

      const [updated] = await db
        .update(media)
        .set(updateData)
        .where(eq(media.id, params.id))
        .returning();

      if (!updated) return status(404, { message: 'Média non trouvé' });
      return updated;
    },
    {
      permission: true,
      params: uuidParam,
      body: mediaUpdate,
      response: { 200: mediaSchema, 404: errorSchema },
    },
  )

  // PUT /media/batch/move - Move multiple media to folder
  .put(
    '/batch/move',
    async ({ body }) => {
      const { ids, folder: folderId } = body;
      const moved = [];

      for (const id of ids) {
        const [updated] = await db
          .update(media)
          .set({ folder: folderId })
          .where(eq(media.id, id))
          .returning();
        if (updated) moved.push(id);
      }

      return { moved, count: moved.length };
    },
    { permission: true, body: batchMoveBody, response: withAuthErrors({ 200: batchResultSchema }) },
  )

  // === MEDIA - DELETE ===
  .use(permissionGuard('media', 'delete'))

  // DELETE /media/:id - Delete media
  .delete(
    '/:id',
    async ({ params, status, currentUser, request }) => {
      const [item] = await db.select().from(media).where(eq(media.id, params.id));

      if (!item) return status(404, { message: 'Média non trouvé' });

      // Delete file from disk
      try {
        await unlink(join(UPLOAD_DIR, item.filenameDisk));
      } catch {
        // File might not exist, continue anyway
      }

      await db.delete(media).where(eq(media.id, params.id));

      logAudit({
        userId: currentUser?.id,
        action: 'media.delete',
        entityType: 'media',
        entityId: params.id,
        data: { filename: item.filenameOriginal },
        ipAddress: getClientIp(request.headers),
      });

      return { success: true };
    },
    {
      permission: true,
      params: uuidParam,
      response: { 200: successSchema, 404: errorSchema },
    },
  )

  // DELETE /media/batch - Delete multiple media
  .delete(
    '/batch',
    async ({ body }) => {
      const deleted = [];

      for (const id of body.ids) {
        const [item] = await db.select().from(media).where(eq(media.id, id));

        if (item) {
          try {
            await unlink(join(UPLOAD_DIR, item.filenameDisk));
          } catch {
            // Ignore
          }
          await db.delete(media).where(eq(media.id, id));
          deleted.push(id);
        }
      }

      return { deleted, count: deleted.length };
    },
    {
      permission: true,
      body: batchDeleteBody,
      response: withAuthErrors({ 200: batchDeleteResultSchema }),
    },
  );
