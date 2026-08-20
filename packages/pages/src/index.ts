// @repo/pages — les pages, leurs sections, et le miroir en base du registre (ADR-0033).
//
// Ni route, ni plugin Elysia. Et aucune réexportation : ni la grammaire de `@repo/fields`, ni la
// logique de `@repo/pages-registry` — un consommateur qui en a besoin les importe lui-même, sans
// quoi la frontière n'existerait plus que dans l'arborescence (ADR-0059). Voir README.md.

/** Ce que ce paquet possède, nommable dans une faute (ADR-0050). Un produit compose les siennes. */
export type PagesResource = 'page' | 'section' | 'definition';
export {
  invalidateRegistryCache,
  loadRegistry,
  type SyncRegistryOutcome,
  syncRegistry,
  validateSectionData,
} from './definition-service';
export {
  type CreatePageOutcome,
  createPage,
  deletePage,
  findPage,
  findPublishedPageBySlug,
  listPages,
  listPublishedPages,
  loadSections,
  type PageInput,
  type PagePatch,
  type PageWithSections,
  type ReplaceSectionsOutcome,
  replaceSections,
  type SectionInput,
  updatePage,
} from './page-service';
export { type PageReferenceOptions, pageReferenceTarget } from './reference';
export { contentDefinition, contentStatusEnum, page, section } from './schema';
