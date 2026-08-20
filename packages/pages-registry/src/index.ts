// @repo/pages-registry — ce qu'est une section, et ce qui se calcule à partir de cette description.
//
// Aucun stockage, aucune connexion : `@repo/db` est absent du manifeste, donc l'import ne résout
// pas (ADR-0059). Voir README.md.

export {
  type Registry,
  registrySchema,
  type SerializedDefinition,
} from './model';
export {
  checkSection,
  compileSections,
  definitionToSchema,
  registryIssues,
  registryToRows,
  type RegistryRow,
  type RegistryRowInput,
  rowsToRegistry,
  type SectionChecks,
  unknownRefTargets,
  type ValidationResult,
} from './registry';
