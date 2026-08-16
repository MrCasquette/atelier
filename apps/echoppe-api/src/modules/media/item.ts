import { faults } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { faultBody } from '../../lib/fault';
import { buildListResponse, getPaginationParams, listResponse } from '../../lib/pagination';
import { successSchema, withAuthErrors } from '../../lib/response';
import { models } from '../../model';
import { getClientIp, logAudit } from '../audit/service';
import { permissionGuard } from '../auth/rbac';
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
import {
  deleteMedia,
  deleteMediaBatch,
  findMedia,
  listMedia,
  moveMediaBatch,
  updateMediaMetadata,
  uploadMedia,
} from './service';

// Les fichiers de la médiathèque. Surface entièrement protégée : la lecture publique d'un fichier
// passe par `asset.ts` (`/assets/:id`).

export const mediaItemRoutes = new Elysia({ prefix: '/media', detail: { tags: ['Media'] } })
  .use(models)
  .use(permissionGuard('media', 'read'))

  // GET /media - Liste avec recherche, filtre, tri et pagination
  .get(
    '/',
    async ({ query }) => {
      const { page, limit, offset } = getPaginationParams(query);
      const { items, total } = await listMedia(query, limit, offset);

      return buildListResponse(items, total, page, limit);
    },
    { permission: true, query: mediaQuery, response: listResponse(mediaSchema) },
  )

  // GET /media/:id
  .get(
    '/:id',
    async ({ params, status }) => {
      const item = await findMedia(params.id);

      if (!item) return status(404, faultBody(faults.notFound('media')));
      return item;
    },
    {
      permission: true,
      params: uuidParam,
      response: {
        200: mediaSchema,
        404: 'ErrorResponse',
      },
    },
  )

  .use(permissionGuard('media', 'create'))

  // POST /media/upload - Téléversement d'un ou plusieurs fichiers
  .post(
    '/upload',
    async ({ body, currentUser, request }) => {
      const files = Array.isArray(body.file) ? body.file : [body.file];
      const created = await uploadMedia(files, {
        folder: body.folder,
        folderName: body.folderName,
      });

      for (const item of created) {
        logAudit({
          userId: currentUser?.id,
          action: 'media.upload',
          entityType: 'media',
          entityId: item.id,
          data: { filename: item.filenameOriginal, mimeType: item.mimeType },
          ipAddress: getClientIp(request.headers),
        });
      }

      // Un seul fichier téléversé → un objet ; plusieurs → un tableau. Le contrat le dit déjà.
      return created.length === 1 ? created[0] : created;
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
      const updated = await updateMediaMetadata(params.id, body);

      if (!updated) return status(404, faultBody(faults.notFound('media')));
      return updated;
    },
    {
      permission: true,
      params: uuidParam,
      body: mediaUpdate,
      response: { 200: mediaSchema, 404: 'ErrorResponse' },
    },
  )

  // PUT /media/batch/move
  .put(
    '/batch/move',
    async ({ body }) => {
      const moved = await moveMediaBatch(body.ids, body.folder);

      return { moved, count: moved.length };
    },
    { permission: true, body: batchMoveBody, response: withAuthErrors({ 200: batchResultSchema }) },
  )

  .use(permissionGuard('media', 'delete'))

  // DELETE /media/:id
  .delete(
    '/:id',
    async ({ params, status, currentUser, request }) => {
      const deleted = await deleteMedia(params.id);

      if (!deleted) return status(404, faultBody(faults.notFound('media')));

      logAudit({
        userId: currentUser?.id,
        action: 'media.delete',
        entityType: 'media',
        entityId: params.id,
        data: { filename: deleted.filenameOriginal },
        ipAddress: getClientIp(request.headers),
      });

      return { success: true };
    },
    {
      permission: true,
      params: uuidParam,
      response: { 200: successSchema, 404: 'ErrorResponse' },
    },
  )

  // DELETE /media/batch
  .delete(
    '/batch',
    async ({ body }) => {
      const deleted = await deleteMediaBatch(body.ids);

      return { deleted, count: deleted.length };
    },
    {
      permission: true,
      body: batchDeleteBody,
      response: withAuthErrors({ 200: batchDeleteResultSchema }),
    },
  );
