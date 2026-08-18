import { faults } from '@echoppe/core';
import { menu } from '@repo/menus';
import { db, eq } from '@repo/db';
import { resolveMenuItems } from '@repo/menus';
import { Elysia, t } from 'elysia';
import { faultBody } from '../../lib/fault';
import { withNotFound } from '../../lib/response';
import { models } from '../../model';
import { references } from '../reference/targets';

// Lecture storefront des menus de navigation. Public. Un menu est fetché par son `handle` stable
// (main, footer…) ; ses refs internes sont résolues en projection { id, slug, name }.

export const menusRoutes = new Elysia({ prefix: '/menus', detail: { tags: ['Menus'] } })
  .use(models)

  // GET /menus/by-handle/:handle - Menu résolu (arbre d'items, refs internes projetées).
  .get(
    '/by-handle/:handle',
    async ({ params, status }) => {
      const [row] = await db.select().from(menu).where(eq(menu.handle, params.handle));
      if (!row) {
        return status(404, faultBody(faults.notFound('menu')));
      }
      // `row.items` est typé MenuItem[] (colonne $type) : validé à l'écriture, trusté en lecture.
      return {
        handle: row.handle,
        label: row.label,
        items: await resolveMenuItems(row.items, references),
      };
    },
    {
      params: t.Object({ handle: t.String() }),
      response: withNotFound({ 200: 'Menu' }),
    },
  );
