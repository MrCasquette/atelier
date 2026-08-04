/**
 * Service checkout - logique métier extraite de la route
 */
import {
  and,
  cart,
  cartItem,
  country,
  db,
  eq,
  getPaymentAdapter,
  inArray,
  order,
  orderItem,
  type PaymentProvider,
  payment,
  product,
  sql,
  taxRate,
  variant,
} from '@echoppe/core';
import { calculateAddonPrice, getPersonalizationFieldsByProduct } from '../utils/personalization';

// ============================================================================
// TYPES
// ============================================================================

export interface AddressInput {
  firstName: string;
  lastName: string;
  company?: string;
  street: string;
  street2?: string;
  postalCode: string;
  city: string;
  countryCode: string;
  phone?: string;
}

export interface AddressSnapshot {
  firstName: string;
  lastName: string;
  company: string | null;
  street: string;
  street2: string | null;
  postalCode: string;
  city: string;
  country: { code: string; name: string };
  phone: string | null;
}

export interface CartItemWithDetails {
  id: string;
  quantity: number;
  personalization: Record<string, string> | null;
  variant: {
    id: string;
    priceHt: string;
    sku: string | null;
    quantity: number;
  };
  product: {
    id: string;
    name: string;
    taxRateId: string;
  };
}

interface OrderItemData {
  variantId: string;
  label: string;
  quantity: number;
  unitPriceHt: number;
  personalization: Record<string, string> | null;
  addonPriceHt: number;
  taxRateValue: number;
  totalHt: number;
  totalTtc: number;
}

export interface OrderTotals {
  subtotalHt: number;
  shippingHt: number;
  discountHt: number;
  totalHt: number;
  totalTax: number;
  totalTtc: number;
  items: OrderItemData[];
}

// ============================================================================
// FUNCTIONS
// ============================================================================

export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(order)
    .where(sql`EXTRACT(YEAR FROM ${order.dateCreated}) = ${year}`);

  const num = (Number(result?.count ?? 0) + 1).toString().padStart(5, '0');
  return `CMD-${year}-${num}`;
}

export async function createAddressSnapshot(input: AddressInput): Promise<AddressSnapshot | null> {
  const [countryData] = await db
    .select({ code: country.code, name: country.name })
    .from(country)
    .where(eq(country.code, input.countryCode.toUpperCase()));

  if (!countryData) return null;

  return {
    firstName: input.firstName,
    lastName: input.lastName,
    company: input.company ?? null,
    street: input.street,
    street2: input.street2 ?? null,
    postalCode: input.postalCode,
    city: input.city,
    country: countryData,
    phone: input.phone ?? null,
  };
}

export async function getActiveCart(customerId: string): Promise<{ id: string } | null> {
  const [cartData] = await db
    .select({ id: cart.id })
    .from(cart)
    .where(and(eq(cart.customer, customerId), eq(cart.status, 'active')));
  return cartData ?? null;
}

export async function getCartItems(cartId: string): Promise<CartItemWithDetails[]> {
  return db
    .select({
      id: cartItem.id,
      quantity: cartItem.quantity,
      personalization: cartItem.personalization,
      variant: {
        id: variant.id,
        priceHt: variant.priceHt,
        sku: variant.sku,
        quantity: variant.quantity,
      },
      product: {
        id: product.id,
        name: product.name,
        taxRateId: product.taxRate,
      },
    })
    .from(cartItem)
    .innerJoin(variant, eq(cartItem.variant, variant.id))
    .innerJoin(product, eq(variant.product, product.id))
    .where(eq(cartItem.cart, cartId));
}

export function validateStock(items: CartItemWithDetails[]): string | null {
  for (const item of items) {
    const available = item.variant.quantity;
    if (item.quantity > available) {
      return `Stock insuffisant pour ${item.product.name} (${available} disponible)`;
    }
  }
  return null;
}

export async function calculateOrderTotals(items: CartItemWithDetails[]): Promise<OrderTotals> {
  const taxRateIds = [...new Set(items.map((item) => item.product.taxRateId))];
  const taxRates = await db
    .select({ id: taxRate.id, rate: taxRate.rate })
    .from(taxRate)
    .where(inArray(taxRate.id, taxRateIds));
  const taxRateMap = new Map(taxRates.map((tr) => [tr.id, parseFloat(tr.rate)]));

  // Supplément de personnalisation par produit (ADR-0010) : autoritaire back, ajouté au prix unitaire.
  const productIds = [...new Set(items.map((item) => item.product.id))];
  const fieldsByProduct = await getPersonalizationFieldsByProduct(productIds);
  const addonFor = (productId: string, value: Record<string, string> | null) =>
    calculateAddonPrice(fieldsByProduct.get(productId) ?? [], value);

  let subtotalHt = 0;
  const orderItems: OrderItemData[] = [];

  for (const item of items) {
    const unitPriceHt = parseFloat(item.variant.priceHt);
    const addonPriceHt = addonFor(item.product.id, item.personalization);
    const taxRateValue = taxRateMap.get(item.product.taxRateId) ?? 20;
    const totalHt = (unitPriceHt + addonPriceHt) * item.quantity;
    const totalTtc = totalHt * (1 + taxRateValue / 100);

    subtotalHt += totalHt;

    const label = item.variant.sku
      ? `${item.product.name} — ${item.variant.sku}`
      : item.product.name;

    orderItems.push({
      variantId: item.variant.id,
      label,
      quantity: item.quantity,
      unitPriceHt,
      personalization: item.personalization,
      addonPriceHt,
      taxRateValue,
      totalHt,
      totalTtc,
    });
  }

  const shippingHt = 0;
  const discountHt = 0;
  const totalHt = subtotalHt + shippingHt - discountHt;
  const totalTax = orderItems.reduce((sum, item) => sum + (item.totalTtc - item.totalHt), 0);
  const totalTtc = totalHt + totalTax;

  return { subtotalHt, shippingHt, discountHt, totalHt, totalTax, totalTtc, items: orderItems };
}

export async function createOrder(
  customerId: string,
  orderNumber: string,
  shippingAddress: AddressSnapshot,
  billingAddress: AddressSnapshot,
  totals: OrderTotals,
  customerNote?: string,
): Promise<{ id: string; orderNumber: string }> {
  const [createdOrder] = await db
    .insert(order)
    .values({
      orderNumber,
      customer: customerId,
      status: 'pending',
      shippingAddress,
      billingAddress,
      subtotalHt: totals.subtotalHt.toFixed(2),
      shippingHt: totals.shippingHt.toFixed(2),
      discountHt: totals.discountHt.toFixed(2),
      totalHt: totals.totalHt.toFixed(2),
      totalTax: totals.totalTax.toFixed(2),
      totalTtc: totals.totalTtc.toFixed(2),
      customerNote,
    })
    .returning();

  await db.insert(orderItem).values(
    totals.items.map((item) => ({
      order: createdOrder.id,
      variant: item.variantId,
      label: item.label,
      quantity: item.quantity,
      unitPriceHt: item.unitPriceHt.toFixed(2),
      personalization: item.personalization,
      addonPriceHt: item.addonPriceHt.toFixed(2),
      taxRate: item.taxRateValue.toFixed(2),
      totalHt: item.totalHt.toFixed(2),
      totalTtc: item.totalTtc.toFixed(2),
    })),
  );

  return createdOrder;
}

export async function initiatePayment(
  orderId: string,
  orderNumber: string,
  totalTtc: number,
  provider: PaymentProvider,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> {
  const adapter = getPaymentAdapter(provider);
  const amountCents = Math.round(totalTtc * 100);

  const session = await adapter.createCheckout({
    orderId,
    amount: amountCents,
    currency: 'EUR',
    successUrl,
    cancelUrl,
    metadata: { orderNumber },
  });

  await db.insert(payment).values({
    order: orderId,
    provider,
    status: 'pending',
    amount: totalTtc.toFixed(2),
  });

  return { url: session.url };
}

export async function rollbackOrder(orderId: string): Promise<void> {
  await db.delete(orderItem).where(eq(orderItem.order, orderId));
  await db.delete(order).where(eq(order.id, orderId));
}
