import { Elysia, t } from 'elysia';
import { errorSchema, successSchema, withAuthErrors } from '../../lib/response';
import { getClientIp, logAudit } from '../audit/service';
import { permissionGuard } from '../auth/rbac';
import { folderBody, folderSchema, uuidParam } from './model';
import { createFolder, deleteFolder, listFolders, updateFolder } from './service';

// Arborescence de la médiathèque. Sous-concept du média : même préfixe, même ressource RBAC
// (`media`), mais son propre cycle de vie — d'où un contrôleur à part.
//
// Déclaré AVANT `mediaItemRoutes` dans `index.ts` : `/media/folders` doit être posé avant
// `/media/:id`.

export const mediaFolderRoutes = new Elysia({ prefix: '/media', detail: { tags: ['Media'] } })
  .use(permissionGuard('media', 'read'))

  // GET /media/folders - Liste plate des dossiers, pour reconstruire l'arbre côté client
  .get('/folders', () => listFolders(), {
    permission: true,
    response: t.Array(folderSchema),
  })

  .use(permissionGuard('media', 'create'))

  // POST /media/folders
  .post(
    '/folders',
    async ({ body, currentUser, request }) => {
      const created = await createFolder(body);

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

  .use(permissionGuard('media', 'update'))

  // PUT /media/folders/:id
  .put(
    '/folders/:id',
    async ({ params, body, status }) => {
      const updated = await updateFolder(params.id, body);

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

  .use(permissionGuard('media', 'delete'))

  // DELETE /media/folders/:id - Les enfants (dossiers et médias) remontent au parent.
  .delete(
    '/folders/:id',
    async ({ params, status, currentUser, request }) => {
      const deleted = await deleteFolder(params.id);

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
  );
