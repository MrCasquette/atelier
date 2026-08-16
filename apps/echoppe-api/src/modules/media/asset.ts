import { faults } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { faultBody } from '../../lib/fault';
import { models } from '../../model';
import { readAsset } from './service';

// Livraison publique d'un fichier de la médiathèque. Préfixe distinct de `/media` — c'est l'URL que
// portent les pages et les fiches produit — mais même concept propriétaire : le fichier appartient
// au média, pas à son consommateur (ADR-0042 §2).

export const assetsRoutes = new Elysia({ prefix: '/assets', detail: { tags: ['Assets'] } })
  .use(models)
  .get(
    '/:id',
    async ({ params, status, set }) => {
      const asset = await readAsset(params.id);

      switch (asset.outcome) {
        case 'media-not-found':
          return status(404, faultBody(faults.notFound('media')));
        case 'file-missing':
          return status(404, faultBody(faults.notFound('file')));
        case 'found':
          set.headers['content-type'] = asset.mimeType;
          set.headers['cache-control'] = 'public, max-age=31536000';
          return asset.file;
      }
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: { 404: 'ErrorResponse' },
    },
  );
