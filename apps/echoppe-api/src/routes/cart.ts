import { randomBytes } from 'node:crypto';
import {
  and,
  cart,
  cartItem,
  customer,
  customerSession,
  db,
  eq,
  gt,
  inArray,
  isNull,
  option,
  optionValue,
  product,
  productMedia,
  variant,
  variantOptionValue,
} from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { models } from '../models';
import {
  calculateAddonPrice,
  displayPersonalization,
  getPersonalizationFields,
  getPersonalizationFieldsByProduct,
  resolvePersonalization,
} from '../utils/personalization';
import {
  badRequestResponse,
  forbiddenResponse,
  notFoundResponse,
  successSchema,
  unauthorizedResponse,
} from '../utils/responses';

const CART_COOKIE_NAME = 'echoppe_cart_session';
const CUSTOMER_COOKIE_NAME = 'echoppe_customer_session';
const CART_SESSION_DAYS = 30;

const cookieSchema = t.Cookie({
  [CART_COOKIE_NAME]: t.Optional(t.String()),
  [CUSTOMER_COOKIE_NAME]: t.Optional(t.String()),
});

// Schémas d'entité panier (Cart, CartMerge) → src/models/cart.ts

function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

// Helper to get current customer from session
async function getCurrentCustomer(token: string | undefined) {
  if (!token) return null;

  const [sessionData] = await db
    .select({
      customerId: customer.id,
    })
    .from(customerSession)
    .innerJoin(customer, eq(customerSession.customer, customer.id))
    .where(and(eq(customerSession.token, token), gt(customerSession.expiresAt, new Date())));

  return sessionData?.customerId ?? null;
}

// Helper to get or create cart
async function getOrCreateCart(
  customerId: string | null,
  cartSessionId: string | null,
  setCookie: (sessionId: string) => void,
): Promise<{ cartId: string; sessionId: string | null }> {
  // If customer is logged in, find their cart
  if (customerId) {
    const [existingCart] = await db
      .select({ id: cart.id })
      .from(cart)
      .where(and(eq(cart.customer, customerId), eq(cart.status, 'active')));

    if (existingCart) {
      return { cartId: existingCart.id, sessionId: null };
    }

    // Create new cart for customer
    const [newCart] = await db
      .insert(cart)
      .values({ customer: customerId })
      .returning({ id: cart.id });

    return { cartId: newCart.id, sessionId: null };
  }

  // Anonymous cart
  if (cartSessionId) {
    const [existingCart] = await db
      .select({ id: cart.id })
      .from(cart)
      .where(and(eq(cart.sessionId, cartSessionId), eq(cart.status, 'active')));

    if (existingCart) {
      return { cartId: existingCart.id, sessionId: cartSessionId };
    }
  }

  // Create new anonymous cart
  const sessionId = generateSessionId();
  const [newCart] = await db.insert(cart).values({ sessionId }).returning({ id: cart.id });

  // Set cookie via callback
  setCookie(sessionId);

  return { cartId: newCart.id, sessionId };
}

// Helper to get cart with items
async function getCartWithItems(cartId: string) {
  const cartData = await db.select().from(cart).where(eq(cart.id, cartId));

  if (!cartData.length) {
    throw new Error(`Cart not found: ${cartId}`);
  }

  const items = await db
    .select({
      id: cartItem.id,
      quantity: cartItem.quantity,
      dateAdded: cartItem.dateAdded,
      personalization: cartItem.personalization,
      variant: {
        id: variant.id,
        sku: variant.sku,
        priceHt: variant.priceHt,
        compareAtPriceHt: variant.compareAtPriceHt,
      },
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
      },
    })
    .from(cartItem)
    .innerJoin(variant, eq(cartItem.variant, variant.id))
    .innerJoin(product, eq(variant.product, product.id))
    .where(eq(cartItem.cart, cartId));

  // Get featured images for all products in cart
  const productIds = [...new Set(items.map((item) => item.product.id))];
  const featuredImages =
    productIds.length > 0
      ? await db
          .select({ productId: productMedia.product, mediaId: productMedia.media })
          .from(productMedia)
          .where(and(inArray(productMedia.product, productIds), eq(productMedia.isFeatured, true)))
      : [];
  const featuredImageMap = new Map(featuredImages.map((fi) => [fi.productId, fi.mediaId]));

  // Get option values (Couleur : Argent, Taille : 52…) for all variants in cart.
  const variantIds = [...new Set(items.map((item) => item.variant.id))];
  const optionRows =
    variantIds.length > 0
      ? await db
          .select({
            variant: variantOptionValue.variant,
            option: option.name,
            value: optionValue.value,
            optionSort: option.sortOrder,
            valueSort: optionValue.sortOrder,
          })
          .from(variantOptionValue)
          .innerJoin(optionValue, eq(variantOptionValue.optionValue, optionValue.id))
          .innerJoin(option, eq(optionValue.option, option.id))
          .where(inArray(variantOptionValue.variant, variantIds))
      : [];
  const optionValuesMap = new Map<string, { option: string; value: string }[]>();
  for (const row of optionRows.sort(
    (a, b) => a.optionSort - b.optionSort || a.valueSort - b.valueSort,
  )) {
    const list = optionValuesMap.get(row.variant) ?? [];
    list.push({ option: row.option, value: row.value });
    optionValuesMap.set(row.variant, list);
  }

  // Champs de personnalisation par produit → supplément de ligne (autoritaire back) + affichage.
  const fieldsByProduct = await getPersonalizationFieldsByProduct(productIds);
  const addonFor = (productId: string, value: Record<string, string> | null) =>
    calculateAddonPrice(fieldsByProduct.get(productId) ?? [], value);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalHt = items
    .reduce((sum, item) => {
      const unit =
        parseFloat(item.variant.priceHt) + addonFor(item.product.id, item.personalization);
      return sum + unit * item.quantity;
    }, 0)
    .toFixed(2);

  return {
    id: cartData[0].id,
    status: cartData[0].status,
    items: items.map((item) => ({
      id: item.id,
      variant: {
        id: item.variant.id,
        sku: item.variant.sku,
        priceHt: item.variant.priceHt,
        compareAtPriceHt: item.variant.compareAtPriceHt,
        optionValues: optionValuesMap.get(item.variant.id) ?? [],
        product: {
          ...item.product,
          featuredImage: featuredImageMap.get(item.product.id) ?? null,
        },
      },
      quantity: item.quantity,
      personalization: displayPersonalization(
        fieldsByProduct.get(item.product.id) ?? [],
        item.personalization,
      ),
      addonPriceHt: addonFor(item.product.id, item.personalization).toFixed(2),
      dateAdded: item.dateAdded,
    })),
    itemCount,
    totalHt,
    dateCreated: cartData[0].dateCreated,
    dateUpdated: cartData[0].dateUpdated,
  };
}

export const cartRoutes = new Elysia({
  prefix: '/cart',
  detail: { tags: ['Cart'] },
})
  // Registre central des modèles nommés → components.schemas.
  .use(models)

  // GET /cart - Get current cart
  .get(
    '/',
    async ({ cookie }) => {
      const customerId = await getCurrentCustomer(cookie[CUSTOMER_COOKIE_NAME].value);
      const cartSessionId = cookie[CART_COOKIE_NAME].value;

      // Find existing cart
      let existingCart: { id: string } | undefined;
      if (customerId) {
        [existingCart] = await db
          .select({ id: cart.id })
          .from(cart)
          .where(and(eq(cart.customer, customerId), eq(cart.status, 'active')));
      } else if (cartSessionId) {
        [existingCart] = await db
          .select({ id: cart.id })
          .from(cart)
          .where(and(eq(cart.sessionId, cartSessionId), eq(cart.status, 'active')));
      }

      if (!existingCart) {
        return {
          id: null,
          status: 'empty',
          items: [],
          itemCount: 0,
          totalHt: '0.00',
          dateCreated: null,
          dateUpdated: null,
        };
      }

      const cartWithItems = await getCartWithItems(existingCart.id);
      return cartWithItems;
    },
    {
      cookie: cookieSchema,
      response: { 200: 'Cart' },
    },
  )

  // POST /cart/items - Add item to cart
  .post(
    '/items',
    async ({ body, cookie, status }) => {
      const customerId = await getCurrentCustomer(cookie[CUSTOMER_COOKIE_NAME].value);
      const cartSessionId = cookie[CART_COOKIE_NAME].value ?? null;

      // Check variant exists and has stock
      const [variantData] = await db
        .select({
          id: variant.id,
          product: variant.product,
          quantity: variant.quantity,
          status: variant.status,
        })
        .from(variant)
        .where(eq(variant.id, body.variantId));

      if (!variantData) {
        return status(404, { message: 'Variante non trouvée' });
      }

      if (variantData.status !== 'published') {
        return status(400, { message: 'Variante non disponible' });
      }

      const availableStock = variantData.quantity;
      if (availableStock < body.quantity) {
        return status(400, { message: `Stock insuffisant (${availableStock} disponible)` });
      }

      // Personnalisation (ADR-0010) : valide contre les champs déclarés du produit ; le supplément
      // de prix est calculé côté back, jamais fourni par le client.
      const fields = await getPersonalizationFields(variantData.product);
      const resolved = resolvePersonalization(fields, body.personalization);
      if (resolved.error) {
        return status(400, { message: resolved.error });
      }

      // Get or create cart
      const { cartId } = await getOrCreateCart(customerId, cartSessionId, (sessionId) => {
        cookie[CART_COOKIE_NAME].set({
          value: sessionId,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: CART_SESSION_DAYS * 24 * 60 * 60,
        });
      });

      // Merge uniquement les lignes SANS personnalisation (une ligne personnalisée est unique) :
      // deux prénoms d'une même variante = deux lignes distinctes.
      const [existingItem] = resolved.value
        ? []
        : await db
            .select({ id: cartItem.id, quantity: cartItem.quantity })
            .from(cartItem)
            .where(
              and(
                eq(cartItem.cart, cartId),
                eq(cartItem.variant, body.variantId),
                isNull(cartItem.personalization),
              ),
            );

      if (existingItem) {
        // Update quantity
        const newQuantity = existingItem.quantity + body.quantity;
        if (newQuantity > availableStock) {
          return status(400, { message: `Stock insuffisant (${availableStock} disponible)` });
        }

        await db
          .update(cartItem)
          .set({ quantity: newQuantity })
          .where(eq(cartItem.id, existingItem.id));
      } else {
        // Add new item
        await db.insert(cartItem).values({
          cart: cartId,
          variant: body.variantId,
          quantity: body.quantity,
          personalization: resolved.value,
        });
      }

      // Update cart dateUpdated
      await db.update(cart).set({ dateUpdated: new Date() }).where(eq(cart.id, cartId));

      const cartWithItems = await getCartWithItems(cartId);
      return cartWithItems;
    },
    {
      body: t.Object({
        variantId: t.String({ format: 'uuid' }),
        quantity: t.Number({ minimum: 1 }),
        // Valeurs de personnalisation (ADR-0010) : { <personalizationFieldId>: valeur }. Validées
        // contre les champs déclarés du produit ; le supplément de prix est calculé côté back.
        personalization: t.Optional(t.Record(t.String(), t.String())),
      }),
      cookie: cookieSchema,
      response: {
        200: 'Cart',
        400: badRequestResponse,
        404: notFoundResponse,
      },
    },
  )

  // PATCH /cart/items/:id - Update item quantity
  .patch(
    '/items/:id',
    async ({ params, body, cookie, status }) => {
      const customerId = await getCurrentCustomer(cookie[CUSTOMER_COOKIE_NAME].value);
      const cartSessionId = cookie[CART_COOKIE_NAME].value;

      // Find the cart item
      const [item] = await db
        .select({
          id: cartItem.id,
          cartId: cartItem.cart,
          variantId: cartItem.variant,
        })
        .from(cartItem)
        .where(eq(cartItem.id, params.id));

      if (!item) {
        return status(404, { message: 'Article non trouvé' });
      }

      // Verify cart ownership
      const [cartData] = await db.select().from(cart).where(eq(cart.id, item.cartId));

      if (!cartData) {
        return status(404, { message: 'Panier non trouvé' });
      }

      const isOwner = customerId
        ? cartData.customer === customerId
        : cartData.sessionId === cartSessionId;

      if (!isOwner) {
        return status(403, { message: 'Accès non autorisé' });
      }

      // Check stock
      const [variantData] = await db
        .select({ quantity: variant.quantity })
        .from(variant)
        .where(eq(variant.id, item.variantId));

      const availableStock = variantData?.quantity ?? 0;
      if (body.quantity > availableStock) {
        return status(400, { message: `Stock insuffisant (${availableStock} disponible)` });
      }

      // Update quantity
      await db.update(cartItem).set({ quantity: body.quantity }).where(eq(cartItem.id, params.id));

      // Update cart dateUpdated
      await db.update(cart).set({ dateUpdated: new Date() }).where(eq(cart.id, item.cartId));

      const cartWithItems = await getCartWithItems(item.cartId);
      return cartWithItems;
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      body: t.Object({ quantity: t.Number({ minimum: 1 }) }),
      cookie: cookieSchema,
      response: {
        200: 'Cart',
        400: badRequestResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
      },
    },
  )

  // DELETE /cart/items/:id - Remove item from cart
  .delete(
    '/items/:id',
    async ({ params, cookie, status }) => {
      const customerId = await getCurrentCustomer(cookie[CUSTOMER_COOKIE_NAME].value);
      const cartSessionId = cookie[CART_COOKIE_NAME].value;

      // Find the cart item
      const [item] = await db
        .select({ id: cartItem.id, cartId: cartItem.cart })
        .from(cartItem)
        .where(eq(cartItem.id, params.id));

      if (!item) {
        return status(404, { message: 'Article non trouvé' });
      }

      // Verify cart ownership
      const [cartData] = await db.select().from(cart).where(eq(cart.id, item.cartId));

      if (!cartData) {
        return status(404, { message: 'Panier non trouvé' });
      }

      const isOwner = customerId
        ? cartData.customer === customerId
        : cartData.sessionId === cartSessionId;

      if (!isOwner) {
        return status(403, { message: 'Accès non autorisé' });
      }

      // Delete item
      await db.delete(cartItem).where(eq(cartItem.id, params.id));

      // Update cart dateUpdated
      await db.update(cart).set({ dateUpdated: new Date() }).where(eq(cart.id, item.cartId));

      const cartWithItems = await getCartWithItems(item.cartId);
      return cartWithItems;
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      cookie: cookieSchema,
      response: {
        200: 'Cart',
        403: forbiddenResponse,
        404: notFoundResponse,
      },
    },
  )

  // DELETE /cart - Clear cart
  .delete(
    '/',
    async ({ cookie }) => {
      const customerId = await getCurrentCustomer(cookie[CUSTOMER_COOKIE_NAME].value);
      const cartSessionId = cookie[CART_COOKIE_NAME].value;

      // Find cart
      let existingCart: { id: string } | undefined;
      if (customerId) {
        [existingCart] = await db
          .select({ id: cart.id })
          .from(cart)
          .where(and(eq(cart.customer, customerId), eq(cart.status, 'active')));
      } else if (cartSessionId) {
        [existingCart] = await db
          .select({ id: cart.id })
          .from(cart)
          .where(and(eq(cart.sessionId, cartSessionId), eq(cart.status, 'active')));
      }

      if (!existingCart) {
        return { success: true };
      }

      // Delete all items
      await db.delete(cartItem).where(eq(cartItem.cart, existingCart.id));

      // Update cart dateUpdated
      await db.update(cart).set({ dateUpdated: new Date() }).where(eq(cart.id, existingCart.id));

      return { success: true };
    },
    {
      cookie: cookieSchema,
      response: { 200: successSchema },
    },
  )

  // POST /cart/merge - Merge anonymous cart to customer cart (after login)
  .post(
    '/merge',
    async ({ cookie, status }) => {
      const customerId = await getCurrentCustomer(cookie[CUSTOMER_COOKIE_NAME].value);
      const cartSessionId = cookie[CART_COOKIE_NAME].value;

      if (!customerId) {
        return status(401, { message: 'Non authentifié' });
      }

      if (!cartSessionId) {
        // No anonymous cart to merge
        return { success: true, merged: 0 };
      }

      // Find anonymous cart
      const [anonymousCart] = await db
        .select({ id: cart.id })
        .from(cart)
        .where(and(eq(cart.sessionId, cartSessionId), eq(cart.status, 'active')));

      if (!anonymousCart) {
        // No anonymous cart to merge
        cookie[CART_COOKIE_NAME].remove();
        return { success: true, merged: 0 };
      }

      // Find or create customer cart
      const [customerCart] = await db
        .select({ id: cart.id })
        .from(cart)
        .where(and(eq(cart.customer, customerId), eq(cart.status, 'active')));

      if (!customerCart) {
        // Convert anonymous cart to customer cart
        await db
          .update(cart)
          .set({ customer: customerId, sessionId: null, dateUpdated: new Date() })
          .where(eq(cart.id, anonymousCart.id));

        cookie[CART_COOKIE_NAME].remove();
        return { success: true, merged: 0, converted: true };
      }

      // Merge items from anonymous cart to customer cart
      const anonymousItems = await db
        .select({ variantId: cartItem.variant, quantity: cartItem.quantity })
        .from(cartItem)
        .where(eq(cartItem.cart, anonymousCart.id));

      let mergedCount = 0;
      for (const item of anonymousItems) {
        // Check if variant already in customer cart
        const [existingItem] = await db
          .select({ id: cartItem.id, quantity: cartItem.quantity })
          .from(cartItem)
          .where(and(eq(cartItem.cart, customerCart.id), eq(cartItem.variant, item.variantId)));

        if (existingItem) {
          // Update quantity (add)
          await db
            .update(cartItem)
            .set({ quantity: existingItem.quantity + item.quantity })
            .where(eq(cartItem.id, existingItem.id));
        } else {
          // Add new item
          await db.insert(cartItem).values({
            cart: customerCart.id,
            variant: item.variantId,
            quantity: item.quantity,
          });
        }
        mergedCount++;
      }

      // Delete anonymous cart and its items
      await db.delete(cartItem).where(eq(cartItem.cart, anonymousCart.id));
      await db.delete(cart).where(eq(cart.id, anonymousCart.id));

      // Update customer cart dateUpdated
      await db.update(cart).set({ dateUpdated: new Date() }).where(eq(cart.id, customerCart.id));

      // Remove cart session cookie
      cookie[CART_COOKIE_NAME].remove();

      return { success: true, merged: mergedCount };
    },
    {
      cookie: cookieSchema,
      response: {
        200: 'CartMerge',
        401: unauthorizedResponse,
      },
    },
  );
