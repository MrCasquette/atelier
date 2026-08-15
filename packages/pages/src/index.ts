// @repo/pages — les pages, leurs sections, et le registre qui dit comment une section est faite
// (ADR-0033).
//
// Les DÉFINITIONS de tables sont livrées comme définitions : chaque cœur les inclut dans son barrel
// et donc dans ses migrations (ADR-0025). Aucune route, aucun plugin Elysia — les schémas de
// requête et de réponse appartiennent au produit, parce qu'ils SONT le contrat (ADR-0044). Ce qui
// est ici décrit ce qu'une donnée EST : le registre des définitions, et la logique qui l'applique.
//
// La GRAMMAIRE d'un champ, elle, vit dans `@repo/fields` — une section et une entité la partagent
// intégralement, et les champs ne sont pas une affaire de pages (#35). Elle n'est pas réexportée
// ici : un consommateur qui a besoin d'un champ s'adresse au paquet qui le décrit, sinon la
// frontière n'existe que dans l'arborescence.
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
