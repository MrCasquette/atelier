// @repo/pages — les pages, leurs sections, et le registre qui dit comment une section est faite
// (ADR-0033).
//
// Ni route, ni plugin Elysia. Ne pas réexporter la grammaire de `@repo/fields` d'ici : la frontière
// n'existerait plus que dans l'arborescence. Voir README.md.
export { type Registry, registrySchema, type SerializedDefinition } from './definition-model';
export {
  assertRegistryCoherent,
  invalidateRegistryCache,
  loadRegistry,
  type SyncRegistryOutcome,
  syncRegistry,
  unknownRefTargets,
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
