// @repo/references — le socle sait qu'il existe des cibles référençables, pas lesquelles (ADR-0032).
//
// N'y inscrire aucune entité de produit, et n'y toucher ni à la base ni au HTTP. Voir README.md.
export {
  createReferenceRegistry,
  type EntityProjection,
  type LinkMode,
  linkUrl,
  type ReferenceRegistry,
  type ReferenceTarget,
  type StorageLocation,
  storageOf,
} from './registry';
