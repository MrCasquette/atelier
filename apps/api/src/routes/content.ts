import { asc, contentDefinition, db, eq, menu, page, section } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { type Registry, registrySchema, sectionInputSchema } from '../models/content';
import { menuItemsSchema } from '../models/menu';
import { permissionGuard } from '../plugins/rbac';
import {
  assertRegistryCoherent,
  invalidateRegistryCache,
  loadRegistry,
  validateSectionData,
} from '../services/content-registry';
import { conflictResponse, successSchema, withCrudErrors } from '../utils/responses';

// Administration du module content (page builder). Protégé par RBAC `content`. Les sections
// d'une page sont remplacées d'un bloc via PUT (façon « save de la dynamic zone ») : plus
// simple et atomique que du CRUD granulaire de sections.

const uuidParam = t.Object({ id: t.String({ format: 'uuid' }) });
const pageStatus = t.Union([t.Literal('draft'), t.Literal('published')]);

// Schémas de réponse admin (inline — hors surface storefront).
const adminSectionSchema = t.Object({
  id: t.String(),
  name: t.Nullable(t.String()),
  type: t.String(),
  data: t.Unknown(),
  sort: t.Number(),
});

const adminPageListItem = t.Object({
  id: t.String(),
  slug: t.String(),
  title: t.String(),
  status: pageStatus,
  dateCreated: t.Date(),
  dateUpdated: t.Date(),
});

const adminPageDetail = t.Object({
  id: t.String(),
  slug: t.String(),
  title: t.String(),
  seoTitle: t.Nullable(t.String()),
  seoDescription: t.Nullable(t.String()),
  status: pageStatus,
  dateCreated: t.Date(),
  dateUpdated: t.Date(),
  sections: t.Array(adminSectionSchema),
});

const pageCreateBody = t.Object({
  slug: t.String({ minLength: 1, maxLength: 150 }),
  title: t.String({ minLength: 1, maxLength: 200 }),
  seoTitle: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
  seoDescription: t.Optional(t.Nullable(t.String())),
  status: t.Optional(pageStatus),
});

const pagePatchBody = t.Object({
  slug: t.Optional(t.String({ minLength: 1, maxLength: 150 })),
  title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
  seoTitle: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
  seoDescription: t.Optional(t.Nullable(t.String())),
  status: t.Optional(pageStatus),
});

// Menus (built-in) — schémas admin (items bruts, refs non résolues ; résolution = read storefront).
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

async function loadSections(pageId: string) {
  return db
    .select({
      id: section.id,
      name: section.name,
      type: section.type,
      data: section.data,
      sort: section.sort,
    })
    .from(section)
    .where(eq(section.page, pageId))
    .orderBy(asc(section.sort));
}

// Aplati le registre (sections + components) en lignes `content_definition` (une par définition).
function registryToRows(registry: Registry): (typeof contentDefinition.$inferInsert)[] {
  const toRow =
    (role: 'section' | 'component') => (entry: [string, Registry['sections'][string]]) => {
      const [name, def] = entry;
      return { name, role, label: def.label ?? null, icon: def.icon ?? null, fields: def.fields };
    };
  return [
    ...Object.entries(registry.sections).map(toRow('section')),
    ...Object.entries(registry.components).map(toRow('component')),
  ];
}

export const contentRoutes = new Elysia({ prefix: '/content', detail: { tags: ['Content'] } })

  // === READ ===
  .use(permissionGuard('content', 'read'))

  .get('/pages', async () => db.select().from(page).orderBy(asc(page.title)), {
    permission: true,
    response: { 200: t.Array(adminPageListItem) },
  })

  .get(
    '/pages/:id',
    async ({ params, status }) => {
      const [pageRow] = await db.select().from(page).where(eq(page.id, params.id));
      if (!pageRow) {
        return status(404, { message: 'Page introuvable' });
      }
      return { ...pageRow, sections: await loadSections(pageRow.id) };
    },
    { permission: true, params: uuidParam, response: withCrudErrors({ 200: adminPageDetail }) },
  )

  // Registre des définitions (pour le générateur de formulaires admin et le type-gen front).
  .get('/registry', async () => loadRegistry(), {
    permission: true,
    response: withCrudErrors({ 200: registrySchema }),
  })

  // Menus (built-in) — liste + détail (items bruts pour l'éditeur).
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
    '/pages',
    async ({ body, status }) => {
      const [existing] = await db
        .select({ id: page.id })
        .from(page)
        .where(eq(page.slug, body.slug));
      if (existing) {
        return status(409, { message: 'Une page existe déjà avec ce slug' });
      }
      const [created] = await db.insert(page).values(body).returning();
      return { ...created, sections: [] };
    },
    {
      permission: true,
      body: pageCreateBody,
      response: withCrudErrors({ 200: adminPageDetail, 409: conflictResponse }),
    },
  )

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

  // PUT /content/registry - Synchronise le registre complet (poussé par la CLI @mrcasquette/content).
  // Remplace-tout : la source d'autorité, ce sont les fichiers du dev ; la DB en est le miroir.
  .put(
    '/registry',
    async ({ body, status }) => {
      // Refuse un registre incohérent (ref de component introuvable, cycle) AVANT de persister.
      try {
        assertRegistryCoherent(body);
      } catch (error) {
        return status(422, {
          message: error instanceof Error ? error.message : 'Registre de contenu invalide',
        });
      }

      await db.transaction(async (tx) => {
        await tx.delete(contentDefinition);
        const rows = registryToRows(body);
        if (rows.length > 0) {
          await tx.insert(contentDefinition).values(rows);
        }
      });
      invalidateRegistryCache();
      return { success: true };
    },
    { permission: true, body: registrySchema, response: withCrudErrors({ 200: successSchema }) },
  )

  .patch(
    '/pages/:id',
    async ({ params, body, status }) => {
      const [existing] = await db.select({ id: page.id }).from(page).where(eq(page.id, params.id));
      if (!existing) {
        return status(404, { message: 'Page introuvable' });
      }
      const [updated] = await db
        .update(page)
        .set({ ...body, dateUpdated: new Date() })
        .where(eq(page.id, params.id))
        .returning();
      return { ...updated, sections: await loadSections(params.id) };
    },
    {
      permission: true,
      params: uuidParam,
      body: pagePatchBody,
      response: withCrudErrors({ 200: adminPageDetail }),
    },
  )

  // PUT /content/pages/:id/sections - Remplace toutes les sections (ordre = index du tableau).
  .put(
    '/pages/:id/sections',
    async ({ params, body, status }) => {
      const [existing] = await db.select({ id: page.id }).from(page).where(eq(page.id, params.id));
      if (!existing) {
        return status(404, { message: 'Page introuvable' });
      }

      // Valide chaque bloc contre sa définition dans le registre (validateur générique P2b).
      const errors: string[] = [];
      for (const [index, block] of body.entries()) {
        const result = await validateSectionData(block.type, block.data);
        if (!result.ok) {
          errors.push(
            ...result.errors.map((error) => `bloc ${index} « ${block.type} » : ${error}`),
          );
        }
      }
      if (errors.length > 0) {
        return status(422, { message: errors.join(' ; ') });
      }

      await db.transaction(async (tx) => {
        await tx.delete(section).where(eq(section.page, params.id));
        if (body.length > 0) {
          await tx.insert(section).values(
            body.map((block, index) => ({
              page: params.id,
              name: block.name ?? null,
              type: block.type,
              data: block.data,
              sort: index,
            })),
          );
        }
        await tx.update(page).set({ dateUpdated: new Date() }).where(eq(page.id, params.id));
      });

      return loadSections(params.id);
    },
    {
      permission: true,
      params: uuidParam,
      body: t.Array(sectionInputSchema),
      response: withCrudErrors({ 200: t.Array(adminSectionSchema) }),
    },
  )

  // PUT /content/menus/:id - Met à jour le libellé et/ou l'arbre d'items (validé par menuItemsSchema).
  .put(
    '/menus/:id',
    async ({ params, body, status }) => {
      const [existing] = await db.select({ id: menu.id }).from(menu).where(eq(menu.id, params.id));
      if (!existing) {
        return status(404, { message: 'Menu introuvable' });
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
    '/pages/:id',
    async ({ params, status }) => {
      const [existing] = await db.select({ id: page.id }).from(page).where(eq(page.id, params.id));
      if (!existing) {
        return status(404, { message: 'Page introuvable' });
      }
      await db.delete(page).where(eq(page.id, params.id)); // sections supprimées en cascade
      return { success: true };
    },
    { permission: true, params: uuidParam, response: withCrudErrors({ 200: successSchema }) },
  )

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
