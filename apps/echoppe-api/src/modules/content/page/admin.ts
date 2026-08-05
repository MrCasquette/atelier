import { asc, db, eq, page, section } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { conflictResponse, successSchema, withCrudErrors } from '../../../lib/response';
import { permissionGuard } from '../../../plugins/rbac';
import { validateSectionData } from '../definition/service';
import { sectionInputSchema } from './model';

// Administration du page builder. Protégé par RBAC `content`. Les sections d'une page sont
// remplacées d'un bloc via PUT (façon « save de la dynamic zone ») : plus simple et atomique que
// du CRUD granulaire de sections.

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

export const pageAdminRoutes = new Elysia({ prefix: '/content', detail: { tags: ['Content'] } })
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

  // === UPDATE ===
  .use(permissionGuard('content', 'update'))

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
  );
