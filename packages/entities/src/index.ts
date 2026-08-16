// @repo/entities — une entité déclarée, sa table dérivée, et le journal qui dit laquelle existe
// (ADR-0027, ADR-0028).
//
// Aucune route. Les IDENTIFIANTS passent la liste blanche de `ddl.ts` — jamais d'échappement —, les
// VALEURS sont toujours liées. Voir README.md.

/** Ce que ce paquet possède, nommable dans une faute (ADR-0050). Un produit compose les siennes. */
export type EntitiesResource = 'entity' | 'entity_row';
export {
  addColumnSql,
  type ColumnSpec,
  columnType,
  createTableSql,
  dropColumnSql,
  dropTableSql,
  entityResourceName,
  entityTableName,
  type ForeignKeySpec,
  fieldColumns,
  foreignKeyDdl,
  foreignKeys,
  IDENTITY_COLUMNS,
  identityColumns,
  isValidIdentifier,
  isValidTableName,
  NO_REFERENCE_TABLES,
  type OnDelete,
  type ReferenceTables,
} from './ddl';
export { incoherentLinks, type LinkDeclaration } from './link';
export {
  type EntityDeclaration,
  type EntityLink,
  type EntityRegistry,
  entityDeclarationSchema,
  entityLinkSchema,
  entityRegistrySchema,
} from './model';
export { entityReferenceTarget, syncEntityTargets } from './reference';
export {
  type EntityLookup,
  type EntityPage,
  type EntityRow,
  findDeclaration,
  findEntityRowBySlug,
  findSingletonRow,
  listEntityRows,
} from './row-service';
export { entityDefinition } from './schema';
export {
  type EntityPlan,
  listEntityNames,
  loadEntities,
  type PlanStep,
  type PushOutcome,
  planEntities,
  pushEntities,
} from './service';
export {
  createEntityRow,
  deleteEntityRow,
  type EntityInput,
  updateEntityRow,
  validateEntityData,
  type WriteOutcome,
} from './write-service';
