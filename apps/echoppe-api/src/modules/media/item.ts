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
import { buildListResponse, getPaginationParams, listResponse } from '../../lib/pagination';
import { errorSchema, successSchema, withAuthErrors } from '../../lib/response';
import { permissionGuard } from '../../plugins/rbac';
import { getClientIp, logAudit } from '../audit/service';
import {
  batchDeleteBody,
  batchDeleteResultSchema,
  batchMoveBody,
  batchResultSchema,
  mediaQuery,
  mediaSchema,
  mediaUpdate,
  uploadBody,
  uuidParam,
} from './model';
import { UPLOAD_DIR } from './storage';

// Les fichiers de la médiathèque. Surface entièrement protégée : la lecture publique d'un fichier
// passe par `asset.ts` (`/assets/:id`).

await mkdir(UPLOAD_DIR, { recursive: true });

export const mediaItemRoutes = new Elysia({ prefix: '/media', detail: { tags: ['Media'] } })
  .use(permissionGuard('media', 'read'))

  // GET /media - Liste avec recherche, filtre, tri et pagination
  .get(
    '/',
    async ({ query }) => {
      const { folder: folderId, search, sort, order, all, type } = query;
      const { page, limit, offset } = getPaginationParams(query);

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

      if (type && type !== 'all') {
        if (type === 'images') {
          conditions.push(like(media.mimeType, 'image/%'));
        } else if (type === 'pdf') {
          conditions.push(eq(media.mimeType, 'application/pdf'));
        } else if (type === 'documents') {
          // Documents : PDF, Word, Excel, texte…
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

      const sortField =
        sort === 'name' ? media.filenameOriginal : sort === 'size' ? media.size : media.dateCreated;
      const sortOrder = order === 'asc' ? asc(sortField) : desc(sortField);

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

  // GET /media/:id
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

  .use(permissionGuard('media', 'create'))

  // POST /media/upload - Téléversement d'un ou plusieurs fichiers
  .post(
    '/upload',
    async ({ body, currentUser, request }) => {
      const files = Array.isArray(body.file) ? body.file : [body.file];
      let folderId = body.folder || null;

      // `folderName` sans `folder` : on retrouve le dossier par son nom, ou on le crée.
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

        await Bun.write(filePath, file);

        const width: number | null = null;
        const height: number | null = null;

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

  .use(permissionGuard('media', 'update'))

  // PUT /media/:id - Métadonnées
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

  // PUT /media/batch/move
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

  .use(permissionGuard('media', 'delete'))

  // DELETE /media/:id
  .delete(
    '/:id',
    async ({ params, status, currentUser, request }) => {
      const [item] = await db.select().from(media).where(eq(media.id, params.id));

      if (!item) return status(404, { message: 'Média non trouvé' });

      try {
        await unlink(join(UPLOAD_DIR, item.filenameDisk));
      } catch {
        // Le fichier peut avoir déjà disparu du disque — la ligne, elle, doit partir.
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

  // DELETE /media/batch
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
            // Idem : disque et base peuvent diverger, la base fait foi.
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
