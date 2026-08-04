import { db, eq, menu } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { models } from '../models';
import { resolveMenuItems } from '../services/menu-resolve';
import { withNotFound } from '../utils/responses';

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
        return status(404, { message: 'Menu introuvable' });
      }
      // `row.items` est typé MenuItem[] (colonne $type) : validé à l'écriture, trusté en lecture.
      return { handle: row.handle, label: row.label, items: await resolveMenuItems(row.items) };
    },
    {
      params: t.Object({ handle: t.String() }),
      response: withNotFound({ 200: 'Menu' }),
    },
  );
