import {
  and,
  db,
  desc,
  eq,
  inArray,
  product,
  productMedia,
  variant,
  wishlistItem,
} from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { models } from '../models';
import {
  customerAuthPlugin,
  customerCookieSchema,
  type SessionCustomer,
} from '../plugins/customerAuth';
import { imageRef, loadMediaDimensions } from '../utils/image-ref';
import { errorSchema, notFound, successSchema } from '../utils/responses';

// Wishlist storefront (ADR : surface client authentifiée, comme customer-addresses/orders). Porte
// sur des VARIANTES (PK customer+variant). Ajout idempotent (onConflictDoNothing). La table existait
// déjà (schema.wishlistItem) mais n'était utilisée qu'en nettoyage à la suppression client.

const variantParam = t.Object({ variantId: t.String({ format: 'uuid' }) });

export const wishlistRoutes = new Elysia({ prefix: '/wishlist', detail: { tags: ['Wishlist'] } })
  .use(customerAuthPlugin)
  .use(models)

  // GET /wishlist - Liste enrichie (variante + produit + image), la plus récente en tête.
  .get(
    '/',
    async ({ currentCustomer }) => {
      const customer = currentCustomer as SessionCustomer;

      const rows = await db
        .select({
          variantId: variant.id,
          sku: variant.sku,
          priceHt: variant.priceHt,
          compareAtPriceHt: variant.compareAtPriceHt,
          quantity: variant.quantity,
          productId: product.id,
          name: product.name,
          slug: product.slug,
          dateAdded: wishlistItem.dateAdded,
        })
        .from(wishlistItem)
        .innerJoin(variant, eq(wishlistItem.variant, variant.id))
        .innerJoin(product, eq(variant.product, product.id))
        .where(eq(wishlistItem.customer, customer.id))
        .orderBy(desc(wishlistItem.dateAdded));

      // Image mise en avant par produit (comme le panier) + dimensions (ADR-0021).
      const productIds = [...new Set(rows.map((r) => r.productId))];
      const featured =
        productIds.length > 0
          ? await db
              .select({ productId: productMedia.product, mediaId: productMedia.media })
              .from(productMedia)
              .where(
                and(inArray(productMedia.product, productIds), eq(productMedia.isFeatured, true)),
              )
          : [];
      const featuredByProduct = new Map(featured.map((f) => [f.productId, f.mediaId]));
      const dims = await loadMediaDimensions(featured.map((f) => f.mediaId));

      return rows.map((r) => ({
        variant: {
          id: r.variantId,
          sku: r.sku,
          priceHt: r.priceHt,
          compareAtPriceHt: r.compareAtPriceHt,
          quantity: r.quantity,
        },
        product: { id: r.productId, name: r.name, slug: r.slug },
        featuredImage: imageRef(featuredByProduct.get(r.productId) ?? null, dims),
        dateAdded: r.dateAdded,
      }));
    },
    {
      customerAuth: true,
      cookie: customerCookieSchema,
      response: { 200: 'Wishlist' },
    },
  )

  // POST /wishlist - Épingle une variante (idempotent). 404 si la variante n'existe pas.
  .post(
    '/',
    async ({ currentCustomer, body, status }) => {
      const customer = currentCustomer as SessionCustomer;

      const [exists] = await db
        .select({ id: variant.id })
        .from(variant)
        .where(eq(variant.id, body.variantId));
      if (!exists) return status(404, notFound('Variant'));

      await db
        .insert(wishlistItem)
        .values({ customer: customer.id, variant: body.variantId })
        .onConflictDoNothing();

      return { success: true as const };
    },
    {
      customerAuth: true,
      cookie: customerCookieSchema,
      body: t.Object({ variantId: t.String({ format: 'uuid' }) }),
      response: { 200: successSchema, 404: errorSchema },
    },
  )

  // DELETE /wishlist/:variantId - Retire une variante (no-op si absente).
  .delete(
    '/:variantId',
    async ({ currentCustomer, params }) => {
      const customer = currentCustomer as SessionCustomer;
      await db
        .delete(wishlistItem)
        .where(
          and(eq(wishlistItem.customer, customer.id), eq(wishlistItem.variant, params.variantId)),
        );
      return { success: true as const };
    },
    {
      customerAuth: true,
      cookie: customerCookieSchema,
      params: variantParam,
      response: { 200: successSchema },
    },
  );
