// @repo/fields — la grammaire d'un champ : ce qu'il EST, ce qu'il ACCEPTE.
//
// Ni route, ni table, ni accès base — ce qu'on FAIT d'un champ appartient à son propriétaire.
// Frontière, dépendances et pièges : voir README.md.

export {
  type Components,
  compileFields,
  duplicateFieldNames,
  fieldsToSchema,
} from './compile';
export {
  type SerializedField,
  serializedFieldSchema,
  serializedFieldShape,
} from './model';
