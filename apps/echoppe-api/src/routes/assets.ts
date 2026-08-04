import { join } from 'node:path';
import { db, eq, media } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { UPLOAD_DIR } from '../lib/config';
import { errorSchema } from '../utils/responses';

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
