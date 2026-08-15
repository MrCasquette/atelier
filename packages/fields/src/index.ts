// @repo/fields — la grammaire d'un champ, partagée par les sections et les entités (ADR-0026, #35).
//
// Le paquet livre une DÉFINITION : ce qu'un champ est, et ce qu'il accepte. Aucune route, aucune
// table, aucun accès base — ce qu'on fait d'un champ appartient à son propriétaire.

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
