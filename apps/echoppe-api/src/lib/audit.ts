import { auditLog, db } from '@echoppe/core';

export type AuditAction =
  // Products
  | 'product.create'
  | 'product.update'
  | 'product.delete'
  // Variants
  | 'variant.create'
  | 'variant.update'
  | 'variant.delete'
  // Categories
  | 'category.create'
  | 'category.update'
  | 'category.delete'
  // Collections
  | 'collection.create'
  | 'collection.update'
  | 'collection.delete'
  // Orders
  | 'order.create'
  | 'order.update'
  | 'order.status_change'
  | 'order.cancel'
  | 'order.refund'
  // Users
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.login'
  | 'user.logout'
  // Roles & Permissions
  | 'role.create'
  | 'role.update'
  | 'role.delete'
  | 'permission.update'
  // Media
  | 'media.upload'
  | 'media.update'
  | 'media.delete'
  | 'folder.create'
  | 'folder.update'
  | 'folder.delete'
  // Company
  | 'company.update'
  // Customers
  | 'customer.create'
  | 'customer.update'
  | 'customer.delete'
  | 'customer.anonymize'
  // Stock
  | 'stock.adjust'
  // Shipping
  | 'shipping.config_update'
  | 'shipment.create'
  // Payment
  | 'payment.config_update'
  | 'payment.received'
  | 'payment.refund';

export type EntityType =
  | 'product'
  | 'variant'
  | 'category'
  | 'collection'
  | 'order'
  | 'user'
  | 'role'
  | 'permission'
  | 'media'
  | 'folder'
  | 'company'
  | 'customer'
  | 'stock'
  | 'shipment'
  | 'payment';

export interface LogAuditParams {
  userId?: string;
  action: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  data?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Enregistre une action dans le journal d'audit.
 * Ne lève pas d'erreur en cas d'échec pour ne pas bloquer l'opération principale.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await db.insert(auditLog).values({
      user: params.userId ?? null,
      action: params.action,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      data: params.data ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch (error) {
    // Log silencieusement pour ne pas bloquer l'opération principale
    console.error('[Audit] Failed to log action:', params.action, error);
  }
}

/**
 * Helper pour extraire l'IP depuis le contexte Elysia.
 * Gère les proxies (X-Forwarded-For, X-Real-IP) et l'IP directe.
 */
export function getClientIp(
  headers: Headers,
  server?: { requestIP?: (req: Request) => { address: string } | null },
  request?: Request,
): string | undefined {
  // 1. Headers proxy (priorité)
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // 2. IP directe via Elysia server
  if (server?.requestIP && request) {
    const ip = server.requestIP(request)?.address;
    if (ip) return ip;
  }

  return undefined;
}
