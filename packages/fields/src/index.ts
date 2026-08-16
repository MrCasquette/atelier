// @repo/fields — la grammaire d'un champ : ce qu'il EST, ce qu'il ACCEPTE.
//
// Ni route, ni table, ni accès base — ce qu'on FAIT d'un champ appartient à son propriétaire.
// Frontière, dépendances et pièges : voir README.md.

export {
  type ComponentFault,
  type Components,
  compileFields,
  duplicateFieldNames,
  fieldsToSchema,
  unresolvedComponents,
} from './compile';
export { issuesFrom, issuesOf } from './issues';
export {
  type SerializedField,
  serializedFieldSchema,
  serializedFieldShape,
} from './model';
