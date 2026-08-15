// @repo/fields — la GRAMMAIRE d'un champ, et rien d'autre.
//
// Une section et une entité décrivent leurs champs de la même façon (ADR-0026) : c'est la pièce
// qu'ADR-0012 désigne comme le point d'architecture central, et la seule qu'elles partagent. Elle
// vivait dans `@repo/pages` par accident d'ordre d'extraction — les champs ne sont pas une affaire
// de pages, et `@repo/entities` en dépendait à l'envers du bon sens (#35).
//
// FRONTIÈRE : ce paquet dit ce qu'un champ EST et ce qu'il accepte. Ce qu'on FAIT d'un champ reste
// chez son propriétaire — la traduction en colonne SQL aux entités, le registre à deux rôles et son
// stockage aux pages. Une déclaration d'un côté, une politique de l'autre.
//
// Aucune dépendance à la base : la grammaire se teste sans DATABASE_URL, et c'est délibéré.
//
// Vocabulaire : docs-internal/reference/lexique-prisme.md, ratifié par ADR-0043.

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
