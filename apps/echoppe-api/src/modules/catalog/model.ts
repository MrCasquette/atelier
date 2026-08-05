import type { ColorMetadata } from '@echoppe/core';
import { type Static, t } from 'elysia';
import { listResponse } from '../../lib/pagination';

// Schémas d'entité (réponses) du domaine catalogue — SOURCE UNIQUE. Importés par les
// routes (par valeur) ET agrégés dans le registre `catalogModels` pour être enregistrés
// comme modèles nommés → peuplent `components.schemas` du contrat OpenAPI.

const statusEnum = t.Union([t.Literal('draft'), t.Literal('published'), t.Literal('archived')], {
  description: 'Statut de publication.',
});

// Tags produit (B3) — noms triés, vide si aucun. Partagé cartes / détail / vue admin.
const tagsSchema = t.Array(t.String({ description: "Nom d'un tag." }), {
  description: 'Tags du produit (noms), triés par nom. Vide si aucun.',
});

// Référence image storefront (B5) — UUID + dimensions intrinsèques (px). Le framework n'optimise
// pas les images (pas de resize serveur) : il expose l'original + ses dimensions, à charge du
// storefront de bâtir son composant <Image> (srcset/ratio, anti-CLS). Cf. ADR-0021. Forme unique
// partout où une image est servie (carte, galerie, image de variante, pastille couleur).
export const imageRefSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'UUID du média.' }),
  width: t.Nullable(
    t.Number({ description: 'Largeur intrinsèque en pixels, ou null si inconnue.' }),
  ),
  height: t.Nullable(
    t.Number({ description: 'Hauteur intrinsèque en pixels, ou null si inconnue.' }),
  ),
});

export const defaultVariantSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'UUID de la variante par défaut.' }),
  priceHt: t.String({ description: 'Prix HT, décimal en chaîne (ex. « 12.90 »).' }),
  compareAtPriceHt: t.Nullable(
    t.String({ description: 'Prix barré HT (avant remise), décimal en chaîne.' }),
  ),
  quantity: t.Number({ description: 'Stock disponible.' }),
});

// Pastille de l'axe couleur sur la carte produit — couleur CSS oklch prête au rendu + image
// de variante optionnelle (survol). Cf. `enrichProductCards`.
export const swatchSchema = t.Object({
  optionValueId: t.String({ format: 'uuid', description: "UUID de la valeur d'option (couleur)." }),
  label: t.String({ description: 'Libellé de la couleur (ex. « Rouge »).' }),
  color: t.String({
    description: 'Couleur CSS oklch prête au rendu (ex. « oklch(0.65 0.12 220 / 1) »).',
  }),
  image: t.Nullable(imageRefSchema),
});

export const productListSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique du produit.' }),
  category: t.String({ format: 'uuid', description: 'UUID de la catégorie du produit.' }),
  taxRate: t.String({ format: 'uuid', description: 'UUID du taux de TVA appliqué.' }),
  name: t.String({ description: 'Nom du produit.' }),
  slug: t.String({ description: "Identifiant lisible pour l'URL." }),
  description: t.Nullable(t.String({ description: 'Description du produit.' })),
  status: statusEnum,
  dateCreated: t.Date({ description: 'Date de création.' }),
  dateUpdated: t.Date({ description: 'Date de dernière modification.' }),
  featuredImage: t.Nullable(imageRefSchema),
  defaultVariant: t.Nullable(defaultVariantSchema),
  images: t.Array(imageRefSchema, {
    description: 'Galerie ordonnée (image principale en tête) — survol, miniatures.',
  }),
  swatches: t.Array(swatchSchema, {
    description: 'Axe couleur (option type=color) — pastilles, vide si aucune.',
  }),
  tags: tagsSchema,
});

export const productSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique du produit.' }),
  category: t.String({ format: 'uuid', description: 'UUID de la catégorie du produit.' }),
  taxRate: t.String({ format: 'uuid', description: 'UUID du taux de TVA appliqué.' }),
  name: t.String({ description: 'Nom du produit.' }),
  slug: t.String({ description: "Identifiant lisible pour l'URL." }),
  description: t.Nullable(t.String({ description: 'Description du produit.' })),
  status: statusEnum,
  dateCreated: t.Date({ description: 'Date de création.' }),
  dateUpdated: t.Date({ description: 'Date de dernière modification.' }),
});

// Type d'axe d'option : `string` (valeur texte) ou `color` (pastille oklch).
export const optionTypeSchema = t.Union([t.Literal('string'), t.Literal('color')], {
  description: "Type de l'axe : `string` (texte) ou `color` (pastille couleur).",
});

// Couleur oklch canonique portée par une valeur d'option de type `color`. Bornes structurelles
// (garde-fou anti-garbage) ; le gamut réel dépend de l/h → géré au picker admin + navigateur.
// Rendu CSS : `oklch(l c h / alpha)`.
export const colorMetadataSchema = t.Object(
  {
    l: t.Number({ minimum: 0, maximum: 1, description: 'Lightness 0–1.' }),
    c: t.Number({ minimum: 0, maximum: 0.4, description: 'Chroma (garde-fou 0–0.4).' }),
    h: t.Number({ minimum: 0, maximum: 360, description: 'Hue 0–360.' }),
    alpha: t.Number({ minimum: 0, maximum: 1, description: 'Opacité 0–1.' }),
  },
  { description: 'Couleur oklch canonique (type=color).' },
);

// Garde-fou compile-time : le TypeBox (validation + bornes) doit rester structurellement aligné
// sur la SSOT `ColorMetadata` (core). Toute divergence de forme casse le build ici.
type _ColorMetadataMatchesSSOT =
  Static<typeof colorMetadataSchema> extends ColorMetadata
    ? ColorMetadata extends Static<typeof colorMetadataSchema>
      ? true
      : never
    : never;
const _colorMetadataInSync: _ColorMetadataMatchesSSOT = true;
void _colorMetadataInSync;

export const optionSchema = t.Object({
  id: t.String({ format: 'uuid', description: "Identifiant unique de l'option." }),
  name: t.String({ description: "Nom de l'option (ex. « Taille », « Couleur »)." }),
  type: optionTypeSchema,
});

export const optionValueSchema = t.Object({
  id: t.String({ format: 'uuid', description: "Identifiant unique de la valeur d'option." }),
  option: t.String({ format: 'uuid', description: "UUID de l'option parente." }),
  value: t.String({ description: 'Valeur (ex. « M », « Rouge »).' }),
  metadata: t.Nullable(colorMetadataSchema),
  sortOrder: t.Number({ description: "Ordre d'affichage." }),
});

export const variantSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique de la variante.' }),
  product: t.String({ format: 'uuid', description: 'UUID du produit parent.' }),
  sku: t.Nullable(t.String({ description: 'Référence interne (SKU).' })),
  barcode: t.Nullable(t.String({ description: 'Code-barres (EAN/UPC).' })),
  priceHt: t.String({ description: 'Prix HT, décimal en chaîne (ex. « 12.90 »).' }),
  compareAtPriceHt: t.Nullable(
    t.String({ description: 'Prix barré HT (avant remise), décimal en chaîne.' }),
  ),
  costPrice: t.Nullable(
    t.String({ description: "Coût d'achat HT (donnée interne, non exposée au storefront)." }),
  ),
  weight: t.Nullable(t.String({ description: 'Poids en kg, décimal en chaîne.' })),
  length: t.Nullable(t.String({ description: 'Longueur en cm, décimal en chaîne.' })),
  width: t.Nullable(t.String({ description: 'Largeur en cm, décimal en chaîne.' })),
  height: t.Nullable(t.String({ description: 'Hauteur en cm, décimal en chaîne.' })),
  isDefault: t.Boolean({ description: 'Variante affichée par défaut sur la fiche produit.' }),
  status: statusEnum,
  sortOrder: t.Number({ description: "Ordre d'affichage." }),
  quantity: t.Number({ description: 'Stock disponible.' }),
  lowStockThreshold: t.Nullable(
    t.Number({ description: "Seuil d'alerte de stock bas (donnée interne)." }),
  ),
});

// Projection STOREFRONT du variant : la vue complète `variantSchema` ci-dessus est la vue
// admin ; elle expose des champs de gestion interne qui ne doivent pas fuiter dans le
// contrat public :
// - `costPrice` = coût d'achat → marge (secret commercial),
// - `lowStockThreshold` = seuil d'alerte stock (info opérationnelle interne).
// Elysia nettoie la réponse selon le schéma → omettre ces champs suffit à les masquer.
export const variantPublicSchema = t.Omit(variantSchema, ['costPrice', 'lowStockThreshold']);

// Variant enrichi de ses valeurs d'option (fiche produit) — projection storefront.
export const variantDetailSchema = t.Composite([
  variantPublicSchema,
  t.Object({
    optionValues: t.Array(
      t.String({ format: 'uuid', description: "UUID d'une valeur d'option sélectionnée." }),
      { description: 'Valeurs d’option qui définissent cette variante.' },
    ),
    featuredImage: t.Nullable(imageRefSchema, {
      description: 'Média de la variante (`featuredForVariant`) + dimensions, sinon null.',
    }),
  }),
]);

// Option enrichie de ses valeurs (fiche produit).
export const optionDetailSchema = t.Composite([
  optionSchema,
  t.Object({
    sortOrder: t.Number({ description: "Ordre d'affichage de l'option." }),
    values: t.Array(optionValueSchema, { description: "Valeurs possibles de l'option." }),
  }),
]);

// Produit + variants + options (retour de GET /products/:id, PUBLIC → variant projeté).
export const productWithVariantsSchema = t.Composite([
  productSchema,
  t.Object({
    variants: t.Array(variantDetailSchema, { description: 'Variantes du produit.' }),
    options: t.Array(optionDetailSchema, { description: 'Options du produit.' }),
    tags: tagsSchema,
  }),
]);

// Vue ADMIN du variant : la vue COMPLÈTE (`variantSchema`, avec costPrice/lowStockThreshold) +
// ses valeurs d'option. Réservée aux lectures admin (RBAC product.read) → jamais dans la surface
// storefront. Distincte de `variantDetailSchema` (public, sans champs internes).
export const variantAdminDetailSchema = t.Composite([
  variantSchema,
  t.Object({
    optionValues: t.Array(
      t.String({ format: 'uuid', description: "UUID d'une valeur d'option sélectionnée." }),
      { description: 'Valeurs d’option qui définissent cette variante.' },
    ),
  }),
]);

// Champ de personnalisation — vue ADMIN (avec product + sortOrder). Réponse des routes CRUD +
// exposé dans la fiche admin (ADR-0010).
export const personalizationFieldAdminSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'UUID du champ.' }),
  product: t.String({ format: 'uuid', description: 'UUID du produit parent.' }),
  label: t.String({ description: 'Libellé (ex. « Prénom »).' }),
  type: t.Union([t.Literal('text'), t.Literal('textarea')], { description: 'Type de saisie.' }),
  required: t.Boolean({ description: 'Saisie obligatoire.' }),
  maxLength: t.Nullable(t.Number({ description: 'Longueur max, ou null.' })),
  priceHt: t.String({ description: 'Supplément HT, décimal en chaîne.' }),
  sortOrder: t.Number({ description: "Ordre d'affichage." }),
});

// Produit + variants COMPLETS + options + personnalisation (retour de GET /products/:id/full, ADMIN).
// Alimente l'éditeur produit/variants de l'admin (édition de costPrice/lowStockThreshold).
export const productAdminWithVariantsSchema = t.Composite([
  productSchema,
  t.Object({
    variants: t.Array(variantAdminDetailSchema, { description: 'Variantes (vue admin complète).' }),
    options: t.Array(optionDetailSchema, { description: 'Options du produit.' }),
    tags: tagsSchema,
    relatedProductIds: t.Array(t.String({ format: 'uuid' }), {
      description: 'Produits liés curés (B8), dans l’ordre choisi. Vide si aucun.',
    }),
    personalizationEnabled: t.Boolean({ description: 'Le produit accepte une personnalisation.' }),
    personalizationFields: t.Array(personalizationFieldAdminSchema, {
      description: 'Champs de personnalisation déclarés, vide si aucun.',
    }),
  }),
]);

// Média rattaché à un produit (galerie).
export const productMediaSchema = t.Object({
  product: t.String({ format: 'uuid', description: 'UUID du produit.' }),
  media: t.String({ format: 'uuid', description: 'UUID du média.' }),
  sortOrder: t.Number({ description: "Ordre d'affichage dans la galerie." }),
  isFeatured: t.Boolean({ description: 'Média mis en avant (image principale).' }),
  featuredForVariant: t.Nullable(
    t.String({
      format: 'uuid',
      description: 'UUID de la variante pour laquelle ce média est mis en avant.',
    }),
  ),
});

// Champ de personnalisation déclaré par un produit (ADR-0010) — projection storefront.
export const personalizationFieldSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'UUID du champ de personnalisation.' }),
  label: t.String({ description: 'Libellé (ex. « Prénom »).' }),
  type: t.Union([t.Literal('text'), t.Literal('textarea')], { description: 'Type de saisie.' }),
  required: t.Boolean({ description: 'Saisie obligatoire.' }),
  maxLength: t.Nullable(t.Number({ description: 'Longueur max, ou null (illimité).' })),
  priceHt: t.String({ description: 'Supplément HT si rempli, décimal en chaîne (ex. « 5.00 »).' }),
});

// Fiche produit détaillée storefront (GET /products/by-slug/:slug) :
// ci-dessus + image mise en avant + galerie + personnalisation.
export const productDetailSchema = t.Composite([
  productWithVariantsSchema,
  t.Object({
    featuredImage: t.Nullable(imageRefSchema),
    images: t.Array(imageRefSchema, {
      description: 'Galerie de médias du produit.',
    }),
    personalizationEnabled: t.Boolean({
      description: 'Le produit accepte une personnalisation (ADR-0010).',
    }),
    personalizationFields: t.Array(personalizationFieldSchema, {
      description: 'Champs de personnalisation déclarés, vide si aucun.',
    }),
  }),
]);

// Modèles nommés exposés dans le contrat (components.schemas).
export const catalogModels = {
  Product: productSchema,
  ProductWithVariants: productWithVariantsSchema,
  ProductAdminWithVariants: productAdminWithVariantsSchema,
  ProductDetail: productDetailSchema,
  ProductList: listResponse(productListSchema),
  RelatedProducts: t.Array(productListSchema, {
    description: 'Produits liés (curés ou fallback voisinage), en cartes ordonnées.',
  }),
  ProductMedia: productMediaSchema,
  Variant: variantSchema,
  Option: optionSchema,
  OptionValue: optionValueSchema,
  PersonalizationField: personalizationFieldAdminSchema,
};
