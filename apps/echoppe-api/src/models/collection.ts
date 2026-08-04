import { t } from 'elysia';
import { listResponse } from '../utils/pagination';

// Schéma d'entité collection — SOURCE UNIQUE. Importé par les routes (par valeur) ET agrégé
// dans `collectionModels` pour être enregistré comme modèle nommé → peuple
// `components.schemas` du contrat OpenAPI.

export const collectionSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique de la collection.' }),
  name: t.String({ description: 'Nom de la collection.' }),
  slug: t.String({ description: "Identifiant lisible pour l'URL (ex. « nouveautes »)." }),
  description: t.Nullable(t.String({ description: 'Description de la collection.' })),
  image: t.Nullable(
    t.String({ format: 'uuid', description: 'UUID du média illustrant la collection.' }),
  ),
  isVisible: t.Boolean({ description: 'Visible dans la boutique.' }),
  dateCreated: t.Date({ description: 'Date de création.' }),
});

// Modèles nommés exposés dans le contrat (components.schemas).
export const collectionModels = {
  Collection: collectionSchema,
  CollectionList: listResponse(collectionSchema),
};
