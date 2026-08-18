import { type ColorMetadata, option, optionValue, productMedia, variant, variantOptionValue } from '@echoppe/core';
import { and, db, eq, inArray } from '@repo/db';
import { type ImageRef, imageRef, loadMediaDimensions } from '../../media/image-ref';
import { selectDefaultVariants } from './default-variant';
import { getTagsByProduct } from './tags';

// Projection « carte produit » storefront — SOURCE UNIQUE partagée par les endpoints de
// listing (GET /products/, /categories/:id/products, /collections/:id/products). Enrichit
// chaque produit en requêtes batchées (médias + variante par défaut + swatches couleur). Toute
// évolution du payload de carte se fait ici, pas ×3 dans chaque route.
//
// - featuredImage : média mis en avant (image principale), ou null.
// - defaultVariant : id + prix HT / prix barré / stock de la variante par défaut, ou null.
// - images : galerie ordonnée (image featured en tête, puis sortOrder) → survol, miniatures.
// - swatches : axe couleur (option type=color) → pastilles ; chaque swatch porte une couleur CSS
//   oklch prête au rendu + l'image de la variante correspondante (si définie) pour le survol.

// Une pastille de l'axe couleur, dédupliquée par valeur d'option.
interface Swatch {
  optionValueId: string;
  label: string; // valeur ("Rouge")
  color: string; // CSS oklch prêt au rendu
  image: ImageRef | null; // média de la variante portant cette couleur, si défini
}

interface CardExtras {
  featuredImage: ImageRef | null;
  defaultVariant: null;
  images: ImageRef[];
  swatches: Swatch[];
  tags: string[];
}

const emptyCard: CardExtras = {
  featuredImage: null,
  defaultVariant: null,
  images: [],
  swatches: [],
  tags: [],
};

// Sérialise une couleur oklch stockée en chaîne CSS rendue par le navigateur (gamut-mappée).
function oklchString({ l, c, h, alpha }: ColorMetadata): string {
  return `oklch(${l} ${c} ${h} / ${alpha})`;
}

export async function enrichProductCards<T extends { id: string }>(products: T[]) {
  const productIds = products.map((p) => p.id);
  if (productIds.length === 0) {
    return products.map((p) => ({ ...p, ...emptyCard }));
  }

  const [media, defaultVariants, colorRows, tagsByProduct] = await Promise.all([
    db
      .select({
        product: productMedia.product,
        media: productMedia.media,
        sortOrder: productMedia.sortOrder,
        isFeatured: productMedia.isFeatured,
        featuredForVariant: productMedia.featuredForVariant,
      })
      .from(productMedia)
      .where(inArray(productMedia.product, productIds)),
    // Variante par défaut effective (isDefault, sinon 1re publiée) → jamais de faux OOS.
    selectDefaultVariants(productIds),
    // Valeurs de l'axe couleur (option type=color) portées par les variantes de ces produits.
    db
      .select({
        product: variant.product,
        variantId: variant.id,
        optionValueId: optionValue.id,
        label: optionValue.value,
        metadata: optionValue.metadata,
      })
      .from(variant)
      .innerJoin(variantOptionValue, eq(variantOptionValue.variant, variant.id))
      .innerJoin(optionValue, eq(optionValue.id, variantOptionValue.optionValue))
      .innerJoin(option, eq(option.id, optionValue.option))
      .where(and(inArray(variant.product, productIds), eq(option.type, 'color')))
      .orderBy(optionValue.sortOrder),
    // Tags (noms triés) par produit → chips storefront.
    getTagsByProduct(productIds),
  ]);

  // Dimensions (px) de tous les médias référencés → refs image {id,width,height} sans N+1 (B5).
  const dims = await loadMediaDimensions(media.map((m) => m.media));

  // Galerie ordonnée par produit : image featured en premier, puis sortOrder croissant.
  const gallery = new Map<string, ImageRef[]>();
  const sorted = [...media].sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
  for (const m of sorted) {
    const list = gallery.get(m.product) ?? [];
    const ref = imageRef(m.media, dims);
    if (ref) list.push(ref);
    gallery.set(m.product, list);
  }

  const featuredByProduct = new Map(
    media.filter((m) => m.isFeatured).map((m) => [m.product, imageRef(m.media, dims)]),
  );
  const defaultVariantByProduct = new Map(
    defaultVariants.map((dv) => [
      dv.product,
      {
        id: dv.id,
        priceHt: dv.priceHt,
        compareAtPriceHt: dv.compareAtPriceHt,
        quantity: dv.quantity,
      },
    ]),
  );

  // Image par variante (swatch-image / survol) : productMedia.featuredForVariant → ref image.
  const imageByVariant = new Map<string, ImageRef>();
  for (const m of media) {
    const ref = imageRef(m.media, dims);
    if (m.featuredForVariant && ref) imageByVariant.set(m.featuredForVariant, ref);
  }

  // Swatches couleur par produit, dédupliqués par valeur d'option (une couleur = une pastille,
  // même si plusieurs variantes la partagent). Ignore les valeurs sans couleur assignée.
  const swatchesByProduct = new Map<string, Swatch[]>();
  for (const row of colorRows) {
    if (!row.metadata) continue;
    const list = swatchesByProduct.get(row.product) ?? [];
    swatchesByProduct.set(row.product, list);
    const image = imageByVariant.get(row.variantId) ?? null;
    const existing = list.find((s) => s.optionValueId === row.optionValueId);
    if (existing) {
      if (!existing.image && image) existing.image = image;
      continue;
    }
    list.push({
      optionValueId: row.optionValueId,
      label: row.label,
      color: oklchString(row.metadata),
      image,
    });
  }

  return products.map((p) => ({
    ...p,
    featuredImage: featuredByProduct.get(p.id) ?? null,
    defaultVariant: defaultVariantByProduct.get(p.id) ?? null,
    images: gallery.get(p.id) ?? [],
    swatches: swatchesByProduct.get(p.id) ?? [],
    tags: tagsByProduct.get(p.id) ?? [],
  }));
}
