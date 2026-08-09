import { and, asc, db, eq, page, section } from '@echoppe/core';
import { validateSectionData } from '../definition/service';

// Logique du page builder — lecture storefront et administration —, sans rien savoir du transport.
// Les absences sont des `null`, les refus des issues typées (ADR-0044).

export type PageInput = {
  slug: string;
  title: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  status?: 'draft' | 'published';
};

export type PagePatch = Partial<PageInput>;

export type SectionInput = {
  name?: string | null;
  type: string;
  data: unknown;
};

/** Sections d'une page, dans l'ordre d'affichage. */
export function loadSections(pageId: string) {
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

// ============================================
// LECTURE PUBLIQUE
// ============================================

/** Aperçu des pages publiées — navigation, plan de site. */
export function listPublishedPages() {
  return db
    .select({ id: page.id, slug: page.slug, title: page.title })
    .from(page)
    .where(eq(page.status, 'published'))
    .orderBy(asc(page.title));
}

export async function findPublishedPageBySlug(slug: string) {
  const [pageRow] = await db
    .select()
    .from(page)
    .where(and(eq(page.slug, slug), eq(page.status, 'published')));

  if (!pageRow) return null;

  // La surface publique ne montre ni le nom interne du bloc ni son rang : l'ordre du tableau
  // porte déjà le second, et le premier ne sert qu'à l'administration.
  const sections = await db
    .select({ id: section.id, type: section.type, data: section.data })
    .from(section)
    .where(eq(section.page, pageRow.id))
    .orderBy(asc(section.sort));

  return {
    id: pageRow.id,
    slug: pageRow.slug,
    title: pageRow.title,
    seoTitle: pageRow.seoTitle,
    seoDescription: pageRow.seoDescription,
    status: pageRow.status,
    sections,
  };
}

// ============================================
// ADMINISTRATION
// ============================================

export function listPages() {
  return db.select().from(page).orderBy(asc(page.title));
}

export async function findPage(id: string) {
  const [pageRow] = await db.select().from(page).where(eq(page.id, id));
  if (!pageRow) return null;

  return { ...pageRow, sections: await loadSections(pageRow.id) };
}

/** Une page et ses sections — ce que rend `findPage` quand elle en trouve une. */
export type PageWithSections = NonNullable<Awaited<ReturnType<typeof findPage>>>;

export type CreatePageOutcome =
  | { outcome: 'created'; page: PageWithSections }
  /** Le slug identifie la page dans l'URL : il ne peut pas être partagé. */
  | { outcome: 'slug-taken' };

export async function createPage(input: PageInput): Promise<CreatePageOutcome> {
  const [existing] = await db.select({ id: page.id }).from(page).where(eq(page.slug, input.slug));
  if (existing) return { outcome: 'slug-taken' };

  const [created] = await db.insert(page).values(input).returning();
  return { outcome: 'created', page: { ...created, sections: [] } };
}

export async function updatePage(id: string, patch: PagePatch) {
  const [existing] = await db.select({ id: page.id }).from(page).where(eq(page.id, id));
  if (!existing) return null;

  const [updated] = await db
    .update(page)
    .set({ ...patch, dateUpdated: new Date() })
    .where(eq(page.id, id))
    .returning();

  return { ...updated, sections: await loadSections(id) };
}

export type ReplaceSectionsOutcome =
  | { outcome: 'replaced'; sections: Awaited<ReturnType<typeof loadSections>> }
  | { outcome: 'page-not-found' }
  /** Un ou plusieurs blocs ne satisfont pas la définition de leur type. */
  | { outcome: 'invalid'; errors: string[] };

/**
 * Remplace toutes les sections d'une page d'un bloc — façon « save de la dynamic zone » : plus
 * simple et atomique qu'un CRUD granulaire. L'ordre du tableau devient le rang.
 */
export async function replaceSections(
  pageId: string,
  blocks: SectionInput[],
): Promise<ReplaceSectionsOutcome> {
  const [existing] = await db.select({ id: page.id }).from(page).where(eq(page.id, pageId));
  if (!existing) return { outcome: 'page-not-found' };

  // Valide chaque bloc contre sa définition dans le registre (validateur générique P2b).
  const errors: string[] = [];
  for (const [index, block] of blocks.entries()) {
    const result = await validateSectionData(block.type, block.data);
    if (!result.ok) {
      errors.push(...result.errors.map((error) => `bloc ${index} « ${block.type} » : ${error}`));
    }
  }
  if (errors.length > 0) return { outcome: 'invalid', errors };

  await db.transaction(async (tx) => {
    await tx.delete(section).where(eq(section.page, pageId));
    if (blocks.length > 0) {
      await tx.insert(section).values(
        blocks.map((block, index) => ({
          page: pageId,
          name: block.name ?? null,
          type: block.type,
          data: block.data,
          sort: index,
        })),
      );
    }
    await tx.update(page).set({ dateUpdated: new Date() }).where(eq(page.id, pageId));
  });

  return { outcome: 'replaced', sections: await loadSections(pageId) };
}

export async function deletePage(id: string): Promise<boolean> {
  const [existing] = await db.select({ id: page.id }).from(page).where(eq(page.id, id));
  if (!existing) return false;

  await db.delete(page).where(eq(page.id, id)); // sections supprimées en cascade
  return true;
}
