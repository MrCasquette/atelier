import { and, db, eq, lt, order } from '@echoppe/core';

const EXPIRATION_HOURS = 1;

/**
 * Cleanup expired pending orders.
 * Orders in "pending" status for more than 1 hour are marked as "cancelled".
 * Stock is NOT affected because it was never decremented (only on payment success).
 */
export async function cleanupExpiredOrders(): Promise<number> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - EXPIRATION_HOURS);

  // Find and update expired orders (mark as cancelled)
  const result = await db
    .update(order)
    .set({
      status: 'cancelled',
      dateUpdated: new Date(),
    })
    .where(and(eq(order.status, 'pending'), lt(order.dateCreated, cutoff)))
    .returning({ id: order.id });

  if (result.length > 0) {
    console.log(`[Cleanup] Cancelled ${result.length} expired pending orders`);
  }

  return result.length;
}
