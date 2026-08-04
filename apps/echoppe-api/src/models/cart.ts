import { t } from 'elysia';

// Schémas d'entité du domaine panier — SOURCE UNIQUE. Importés par les routes (par valeur)
// ET agrégés dans `cartModels` pour être enregistrés comme modèles nommés → peuplent
// `components.schemas` du contrat OpenAPI.

const variantInCartSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'UUID de la variante.' }),
  sku: t.Nullable(t.String({ description: 'Référence interne (SKU).' })),
  priceHt: t.String({ description: 'Prix HT unitaire, décimal en chaîne (ex. « 12.90 »).' }),
  compareAtPriceHt: t.Nullable(
    t.String({ description: 'Prix HT barré (avant remise), ou null. Décimal en chaîne.' }),
  ),
  optionValues: t.Array(
    t.Object({
      option: t.String({ description: 'Nom de l’option (ex. « Couleur »).' }),
      value: t.String({ description: 'Valeur choisie (ex. « Argent »).' }),
    }),
    { description: 'Options de la variante (ex. Couleur : Argent, Taille : 52).' },
  ),
  product: t.Object(
    {
      id: t.String({ format: 'uuid', description: 'UUID du produit.' }),
      name: t.String({ description: 'Nom du produit.' }),
      slug: t.String({ description: "Identifiant lisible pour l'URL." }),
      featuredImage: t.Nullable(
        t.String({ format: 'uuid', description: 'UUID du média mis en avant.' }),
      ),
    },
    { description: 'Produit rattaché à la variante.' },
  ),
});

const personalizationLineSchema = t.Array(
  t.Object({
    fieldId: t.String({ format: 'uuid', description: 'UUID du champ de personnalisation.' }),
    label: t.String({ description: 'Libellé du champ (ex. « Prénom »).' }),
    value: t.String({ description: 'Valeur saisie par le client.' }),
  }),
  { description: 'Valeurs de personnalisation de la ligne (ADR-0010), vide si aucune.' },
);

const cartItemSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'UUID de la ligne de panier.' }),
  variant: variantInCartSchema,
  quantity: t.Number({ description: 'Quantité commandée.' }),
  personalization: personalizationLineSchema,
  addonPriceHt: t.String({
    description:
      'Supplément de personnalisation HT (unitaire), décimal en chaîne. « 0.00 » si aucun.',
  }),
  dateAdded: t.Date({ description: 'Date d’ajout au panier.' }),
});

const cartStatusEnum = t.Union(
  [t.Literal('active'), t.Literal('converted'), t.Literal('abandoned'), t.Literal('empty')],
  { description: 'État du panier.' },
);

export const cartResponseSchema = t.Object({
  id: t.Union([t.String({ format: 'uuid' }), t.Null()], {
    description: 'UUID du panier, ou null si aucun panier actif.',
  }),
  status: cartStatusEnum,
  items: t.Array(cartItemSchema, { description: 'Lignes du panier.' }),
  itemCount: t.Number({ description: 'Nombre total d’articles (somme des quantités).' }),
  totalHt: t.String({ description: 'Total HT, décimal en chaîne.' }),
  dateCreated: t.Union([t.Date(), t.Null()], { description: 'Date de création, ou null.' }),
  dateUpdated: t.Union([t.Date(), t.Null()], {
    description: 'Date de dernière modification, ou null.',
  }),
});

export const mergeResponseSchema = t.Object({
  success: t.Boolean({ description: 'Opération réussie.' }),
  merged: t.Optional(t.Number({ description: 'Nombre de lignes fusionnées.' })),
  converted: t.Optional(
    t.Boolean({ description: 'Le panier anonyme a été converti en panier client.' }),
  ),
});

// Modèles nommés exposés dans le contrat (components.schemas).
export const cartModels = {
  Cart: cartResponseSchema,
  CartMerge: mergeResponseSchema,
};
