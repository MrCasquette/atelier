import { join } from 'node:path';
import { db, eq, media } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { errorSchema } from '../../lib/response';
import { UPLOAD_DIR } from './storage';

// Livraison publique d'un fichier de la médiathèque. Préfixe distinct de `/media` — c'est l'URL que
// portent les pages et les fiches produit — mais même concept propriétaire : le fichier appartient
// au média, pas à son consommateur (ADR-0042 §2).

export const assetsRoutes = new Elysia({ prefix: '/assets', detail: { tags: ['Assets'] } }).get(
  '/:id',
  async ({ params, status, set }) => {
    const [item] = await db.select().from(media).where(eq(media.id, params.id));

    if (!item) {
      return status(404, { message: 'Media not found' });
    }

    const filePath = join(UPLOAD_DIR, item.filenameDisk);
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      return status(404, { message: 'File not found' });
    }

    set.headers['content-type'] = item.mimeType;
    set.headers['cache-control'] = 'public, max-age=31536000';
    return file;
  },
  {
    params: t.Object({ id: t.String({ format: 'uuid' }) }),
    response: { 404: errorSchema },
  },
);
