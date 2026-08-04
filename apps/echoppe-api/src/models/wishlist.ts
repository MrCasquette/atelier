import { t } from 'elysia';
import { imageRefSchema } from './catalog';

// Schéma d'entité wishlist (liste d'envies) — SOURCE UNIQUE. La wishlist porte sur des VARIANTES
// (PK customer+variant, cf. schema.wishlistItem) : le client épingle une variante précise (taille,
// couleur). Chaque item est enrichi pour un rendu direct (comme les cartes/panier).

const wishlistItemSchema = t.Object({
  variant: t.Object({
    id: t.String({ format: 'uuid', description: 'UUID de la variante épinglée.' }),
    sku: t.Nullable(t.String({ description: 'Référence interne (SKU).' })),
    priceHt: t.String({ description: 'Prix HT, décimal en chaîne (ex. « 12.90 »).' }),
    compareAtPriceHt: t.Nullable(
      t.String({ description: 'Prix HT barré (avant remise), ou null. Décimal en chaîne.' }),
    ),
    quantity: t.Number({ description: 'Stock disponible (0 = rupture).' }),
  }),
  product: t.Object({
    id: t.String({ format: 'uuid', description: 'UUID du produit.' }),
    name: t.String({ description: 'Nom du produit.' }),
    slug: t.String({ description: "Identifiant lisible pour l'URL." }),
  }),
  featuredImage: t.Nullable(imageRefSchema, {
    description: 'Image mise en avant du produit + dimensions (ADR-0021), sinon null.',
  }),
  dateAdded: t.Date({ description: "Date d'ajout à la wishlist." }),
});

// Modèles nommés exposés dans le contrat (components.schemas).
export const wishlistModels = {
  Wishlist: t.Array(wishlistItemSchema, {
    description: 'Wishlist du client, la plus récente en tête.',
  }),
};
