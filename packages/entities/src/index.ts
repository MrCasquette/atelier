// @repo/entities — une entité déclarée, sa table dérivée, et le journal qui dit laquelle existe
// (ADR-0027, ADR-0028).
//
// Une entité est de la DONNÉE : elle garde tout son sens sans le CMS, donc elle va en vraies
// colonnes (ADR-0026). Ce paquet contient la mécanique qui l'y met — traduction déclaration → DDL,
// comparaison au schéma réel, application. Aucune route : les codes HTTP sont du produit
// (ADR-0044).
//
// La DÉFINITION du journal est livrée comme définition ; chaque cœur l'inclut dans son barrel et
// donc dans ses migrations (ADR-0025). Les tables d'entités, elles, ne sont dans aucune migration —
// c'est le prix de la condition sine qua non d'ADR-0028, et il se paie sur le drift guard.
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
