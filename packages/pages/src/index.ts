// @repo/pages — les pages, leurs sections, et le registre qui dit comment une section est faite
// (ADR-0033).
//
// Les DÉFINITIONS de tables sont livrées comme définitions : chaque cœur les inclut dans son barrel
// et donc dans ses migrations (ADR-0025). Aucune route, aucun plugin Elysia — les schémas de
// requête et de réponse appartiennent au produit, parce qu'ils SONT le contrat (ADR-0044). Ce qui
// est ici décrit ce qu'une donnée EST : la grammaire du registre, et la logique qui l'applique.
export {
  type Registry,
  registrySchema,
  type SerializedDefinition,
  type SerializedField,
  serializedFieldSchema,
} from './definition-model';
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
