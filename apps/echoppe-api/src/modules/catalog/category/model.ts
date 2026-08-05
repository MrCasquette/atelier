import { t } from 'elysia';

// Schéma d'entité catégorie (réponse) — source unique, enregistré comme modèle nommé.

export const categorySchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique de la catégorie.' }),
  name: t.String({ description: 'Nom de la catégorie.' }),
  slug: t.String({ description: "Identifiant lisible pour l'URL (ex. « vaisselle »)." }),
  description: t.Nullable(t.String({ description: 'Description de la catégorie.' })),
  parent: t.Nullable(
    t.String({ format: 'uuid', description: 'UUID de la catégorie parente (arborescence).' }),
  ),
  image: t.Nullable(
    t.String({ format: 'uuid', description: 'UUID du média illustrant la catégorie.' }),
  ),
  sortOrder: t.Number({ description: "Ordre d'affichage parmi les catégories de même niveau." }),
  isVisible: t.Boolean({ description: 'Visible dans la boutique.' }),
});

export const categoryModels = {
  Category: categorySchema,
  CategoryList: t.Array(categorySchema),
};
