import {
  and,
  db,
  eq,
  inArray,
  isNotNull,
  option,
  optionValue,
  product,
  productMedia,
  productOption,
  variant,
  variantOptionValue,
} from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { models } from '../../models';
import { variantPublicSchema } from '../../models/catalog';
import { type ImageRef, imageRef, loadMediaDimensions } from '../../utils/image-ref';
import { getPersonalizationFields } from '../../utils/personalization';
import { enrichProductCards } from '../../utils/product-cards';
import { getFallbackRelatedIds, getRelatedProductIds } from '../../utils/related';
import { withNotFound, withReadErrors } from '../../utils/responses';
import { getProductTags } from '../../utils/tags';
import { productParams, productSearchQuery, queryProductCards } from './shared';

// Lectures publiques du catalogue (storefront/SDK) : liste + fiche détaillée. Aucun guard —
// seuls les produits PUBLIÉS sont visibles (404 sinon, pas de fuite de brouillon).
export const publicProductRoutes = new Elysia()
  .use(models)

  // GET /products - Liste publique : produits PUBLIÉS uniquement.
  .get('/', async ({ query }) => queryProductCards(query, [eq(product.status, 'published')]), {
    query: productSearchQuery,
    response: withReadErrors({ 200: 'ProductList' }),
  })

  // GET /products/by-slug/:slug - Get one by slug with variants (public, for storefront)
  .get(
    '/by-slug/:slug',
    async ({ params, status }) => {
      const [found] = await db
        .select()
        .from(product)
        .where(and(eq(product.slug, params.slug), eq(product.status, 'published')));
      if (!found) return status(404, { message: 'Product not found' });

      const variants = await db
        .select()
        .from(variant)
        .where(eq(variant.product, found.id))
        .orderBy(variant.sortOrder);

      const [featuredMedia] = await db
        .select({ mediaId: productMedia.media })
        .from(productMedia)
        .where(and(eq(productMedia.product, found.id), eq(productMedia.isFeatured, true)));

      const allMedia = await db
        .select({
          mediaId: productMedia.media,
          sortOrder: productMedia.sortOrder,
          featuredForVariant: productMedia.featuredForVariant,
        })
        .from(productMedia)
        .where(eq(productMedia.product, found.id))
        .orderBy(productMedia.sortOrder);

      // Dimensions (px) des médias → refs image {id,width,height} sans N+1 (B5).
      const mediaDims = await loadMediaDimensions([
        featuredMedia?.mediaId,
        ...allMedia.map((m) => m.mediaId),
      ]);

      // Image mise en avant par variante (média featuredForVariant) → featuredImage du variant.
      const featuredByVariant = new Map<string, ImageRef>();
      for (const m of allMedia) {
        const ref = imageRef(m.mediaId, mediaDims);
        if (m.featuredForVariant && ref) featuredByVariant.set(m.featuredForVariant, ref);
      }

      const variantIds = variants.map((v) => v.id);
      const usedOptionValues =
        variantIds.length > 0
          ? await db
              .select({ optionValueId: variantOptionValue.optionValue })
              .from(variantOptionValue)
              .where(inArray(variantOptionValue.variant, variantIds))
          : [];
      const usedOptionValueIds = new Set(usedOptionValues.map((ov) => ov.optionValueId));

      const productOptions = await db
        .select({ option: option, sortOrder: productOption.sortOrder })
        .from(productOption)
        .innerJoin(option, eq(productOption.option, option.id))
        .where(eq(productOption.product, found.id))
        .orderBy(productOption.sortOrder);

      const optionsWithValues = await Promise.all(
        productOptions.map(async (po) => {
          const allValues = await db
            .select()
            .from(optionValue)
            .where(eq(optionValue.option, po.option.id))
            .orderBy(optionValue.sortOrder);
          const values = allValues.filter((v) => usedOptionValueIds.has(v.id));
          return { ...po.option, sortOrder: po.sortOrder, values };
        }),
      );

      const filteredOptions = optionsWithValues.filter((o) => o.values.length > 0);

      const variantsWithOptions = await Promise.all(
        variants.map(async (v) => {
          const optionValues = await db
            .select()
            .from(variantOptionValue)
            .where(eq(variantOptionValue.variant, v.id));
          return {
            ...v,
            optionValues: optionValues.map((ov) => ov.optionValue),
            featuredImage: featuredByVariant.get(v.id) ?? null,
          };
        }),
      );

      // Personnalisation (ADR-0010) : champs déclarés si le produit l'accepte.
      const personalizationFields = found.personalizationEnabled
        ? await getPersonalizationFields(found.id)
        : [];

      const tags = await getProductTags(found.id);

      return {
        ...found,
        featuredImage: imageRef(featuredMedia?.mediaId ?? null, mediaDims),
        images: allMedia
          .map((m) => imageRef(m.mediaId, mediaDims))
          .filter((r): r is ImageRef => r !== null),
        variants: variantsWithOptions,
        options: filteredOptions,
        tags,
        personalizationEnabled: found.personalizationEnabled,
        personalizationFields,
      };
    },
    {
      params: t.Object({ slug: t.String() }),
      response: withNotFound({ 200: 'ProductDetail' }),
    },
  )

  // GET /products/:id - Get one with variants (public)
  .get(
    '/:id',
    async ({ params, status }) => {
      const [found] = await db
        .select()
        .from(product)
        .where(and(eq(product.id, params.id), eq(product.status, 'published')));
      if (!found) return status(404, { message: 'Product not found' });

      const variants = await db
        .select()
        .from(variant)
        .where(eq(variant.product, params.id))
        .orderBy(variant.sortOrder);

      const variantMedia = await db
        .select({
          mediaId: productMedia.media,
          featuredForVariant: productMedia.featuredForVariant,
        })
        .from(productMedia)
        .where(
          and(eq(productMedia.product, params.id), isNotNull(productMedia.featuredForVariant)),
        );
      // Dimensions (px) des médias de variante → refs image {id,width,height} (B5).
      const variantDims = await loadMediaDimensions(variantMedia.map((m) => m.mediaId));
      const featuredByVariant = new Map<string, ImageRef>();
      for (const m of variantMedia) {
        const ref = imageRef(m.mediaId, variantDims);
        if (m.featuredForVariant && ref) featuredByVariant.set(m.featuredForVariant, ref);
      }

      const productOptions = await db
        .select({ option: option, sortOrder: productOption.sortOrder })
        .from(productOption)
        .innerJoin(option, eq(productOption.option, option.id))
        .where(eq(productOption.product, params.id))
        .orderBy(productOption.sortOrder);

      const optionsWithValues = await Promise.all(
        productOptions.map(async (po) => {
          const values = await db
            .select()
            .from(optionValue)
            .where(eq(optionValue.option, po.option.id))
            .orderBy(optionValue.sortOrder);
          return { ...po.option, sortOrder: po.sortOrder, values };
        }),
      );

      const variantsWithOptions = await Promise.all(
        variants.map(async (v) => {
          const optionValues = await db
            .select()
            .from(variantOptionValue)
            .where(eq(variantOptionValue.variant, v.id));
          return {
            ...v,
            optionValues: optionValues.map((ov) => ov.optionValue),
            featuredImage: featuredByVariant.get(v.id) ?? null,
          };
        }),
      );

      const tags = await getProductTags(found.id);

      return { ...found, variants: variantsWithOptions, options: optionsWithValues, tags };
    },
    { params: productParams, response: withNotFound({ 200: 'ProductWithVariants' }) },
  )

  // GET /products/:id/related (public) — produits liés curés, sinon fallback voisinage (B8).
  .get(
    '/:id/related',
    async ({ params }) => {
      const [found] = await db
        .select({ id: product.id, category: product.category })
        .from(product)
        .where(and(eq(product.id, params.id), eq(product.status, 'published')));
      if (!found) return [];

      const curated = await getRelatedProductIds(found.id);
      const ids =
        curated.length > 0 ? curated : await getFallbackRelatedIds(found.id, found.category, 8);
      if (ids.length === 0) return [];

      // Ne garde que les liés PUBLIÉS, en préservant l'ordre curé.
      const products = await db
        .select()
        .from(product)
        .where(and(inArray(product.id, ids), eq(product.status, 'published')));
      const byId = new Map(products.map((p) => [p.id, p]));
      const ordered = ids
        .map((id) => byId.get(id))
        .filter((p): p is (typeof products)[number] => p !== undefined);
      return enrichProductCards(ordered);
    },
    { params: productParams, response: { 200: 'RelatedProducts' } },
  )

  // GET /products/:id/variants (public)
  .get(
    '/:id/variants',
    async ({ params }) => {
      const [found] = await db
        .select({ id: product.id })
        .from(product)
        .where(and(eq(product.id, params.id), eq(product.status, 'published')));
      if (!found) return [];

      const variants = await db
        .select()
        .from(variant)
        .where(eq(variant.product, params.id))
        .orderBy(variant.sortOrder);
      return variants;
    },
    { params: productParams, response: t.Array(variantPublicSchema) },
  );
