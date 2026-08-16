import { asc, db, eq, menu } from '@echoppe/core';
import { menuItemsSchema, unknownTargets } from '@repo/menus';
import { Elysia, t } from 'elysia';
import { conflictResponse, successSchema, withCrudErrors } from '../../lib/response';
import { models } from '../../model';
import { permissionGuard } from '../auth/rbac';
import { references } from '../reference/targets';

// Administration des menus. Protégé par RBAC `content` — le menu n'est pas du contenu (ADR-0043,
// sa forme est figée par le framework, hors registre) mais il partage son écran d'administration,
// donc sa ressource de permission.
//
// Items BRUTS : les références internes ne sont pas résolues ici (la résolution est un service de
// lecture storefront, cf. @repo/menus).

const uuidParam = t.Object({ id: t.String({ format: 'uuid' }) });

const adminMenuListItem = t.Object({
  id: t.String(),
  handle: t.String(),
  label: t.String(),
  dateUpdated: t.Date(),
});

const adminMenuDetail = t.Object({
  id: t.String(),
  handle: t.String(),
  label: t.String(),
  items: menuItemsSchema,
});

const menuCreateBody = t.Object({
  handle: t.String({ minLength: 1, maxLength: 100, description: 'Clé stable (main, footer…).' }),
  label: t.String({ minLength: 1, maxLength: 200 }),
});

const menuUpdateBody = t.Object({
  label: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
  items: t.Optional(menuItemsSchema),
});

export const menuAdminRoutes = new Elysia({ prefix: '/content', detail: { tags: ['Content'] } })
  .use(models)
  // === READ ===
  .use(permissionGuard('content', 'read'))

  .get(
    '/menus',
    async () =>
      db
        .select({
          id: menu.id,
          handle: menu.handle,
          label: menu.label,
          dateUpdated: menu.dateUpdated,
        })
        .from(menu)
        .orderBy(asc(menu.label)),
    { permission: true, response: { 200: t.Array(adminMenuListItem) } },
  )

  .get(
    '/menus/:id',
    async ({ params, status }) => {
      const [row] = await db.select().from(menu).where(eq(menu.id, params.id));
      if (!row) {
        return status(404, { message: 'Menu introuvable' });
      }
      return { id: row.id, handle: row.handle, label: row.label, items: row.items };
    },
    { permission: true, params: uuidParam, response: withCrudErrors({ 200: adminMenuDetail }) },
  )

  // === CREATE ===
  .use(permissionGuard('content', 'create'))

  .post(
    '/menus',
    async ({ body, status }) => {
      const [existing] = await db
        .select({ id: menu.id })
        .from(menu)
        .where(eq(menu.handle, body.handle));
      if (existing) {
        return status(409, { message: 'Un menu existe déjà avec ce handle' });
      }
      const [created] = await db
        .insert(menu)
        .values({ handle: body.handle, label: body.label })
        .returning();
      return { id: created.id, handle: created.handle, label: created.label, items: [] };
    },
    {
      permission: true,
      body: menuCreateBody,
      response: withCrudErrors({ 200: adminMenuDetail, 409: conflictResponse }),
    },
  )

  // === UPDATE ===
  .use(permissionGuard('content', 'update'))

  // PUT /content/menus/:id - Met à jour le libellé et/ou l'arbre d'items (validé par menuItemsSchema).
  .put(
    '/menus/:id',
    async ({ params, body, status }) => {
      const [existing] = await db.select({ id: menu.id }).from(menu).where(eq(menu.id, params.id));
      if (!existing) {
        return status(404, { message: 'Menu introuvable' });
      }

      // Le contrat ne peut plus énumérer les cibles (ADR-0032) : leur existence se vérifie ici,
      // contre le registre.
      const unknown = body.items ? unknownTargets(body.items, references) : [];
      if (unknown.length > 0) {
        return status(422, { message: `Cibles référençables inconnues : ${unknown.join(', ')}` });
      }

      const [updated] = await db
        .update(menu)
        .set({
          ...(body.label !== undefined ? { label: body.label } : {}),
          ...(body.items !== undefined ? { items: body.items } : {}),
          dateUpdated: new Date(),
        })
        .where(eq(menu.id, params.id))
        .returning();
      return { id: updated.id, handle: updated.handle, label: updated.label, items: updated.items };
    },
    {
      permission: true,
      params: uuidParam,
      body: menuUpdateBody,
      response: withCrudErrors({ 200: adminMenuDetail }),
    },
  )

  // === DELETE ===
  .use(permissionGuard('content', 'delete'))

  .delete(
    '/menus/:id',
    async ({ params, status }) => {
      const [existing] = await db.select({ id: menu.id }).from(menu).where(eq(menu.id, params.id));
      if (!existing) {
        return status(404, { message: 'Menu introuvable' });
      }
      await db.delete(menu).where(eq(menu.id, params.id));
      return { success: true };
    },
    { permission: true, params: uuidParam, response: withCrudErrors({ 200: successSchema }) },
  );
