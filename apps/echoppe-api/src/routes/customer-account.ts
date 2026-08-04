import { customer, db, eq } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { models } from '../models';
import {
  customerAuthPlugin,
  customerCookieSchema,
  type SessionCustomer,
} from '../plugins/customerAuth';
import { unauthorizedResponse } from '../utils/responses';

// Compte client (données du profil) — distinct de `customer-auth` (credentials/session).
// Futur foyer de la famille RGPD (export des données, demande de suppression). Toutes les
// routes sont gardées par `customerAuth` et agissent sur `currentCustomer.id`.

export const customerAccountRoutes = new Elysia({
  prefix: '/customer',
  detail: { tags: ['Customer Account'] },
})
  .use(customerAuthPlugin)
  // Registre central des modèles nommés → components.schemas.
  .use(models)

  // PATCH /customer/profile - Mise à jour du profil (self-service).
  // Volontairement hors périmètre : l'email (changement = flux vérifié dédié) et le mot de
  // passe (route dédiée dans customer-auth). Champs partiels : seuls ceux fournis sont modifiés.
  .patch(
    '/profile',
    async ({ body, currentCustomer }) => {
      const c = currentCustomer as SessionCustomer;

      const updates: Partial<typeof customer.$inferInsert> = { dateUpdated: new Date() };
      if (body.firstName !== undefined) updates.firstName = body.firstName;
      if (body.lastName !== undefined) updates.lastName = body.lastName;
      if (body.phone !== undefined) updates.phone = body.phone;
      if (body.marketingOptin !== undefined) updates.marketingOptin = body.marketingOptin;

      const [updated] = await db
        .update(customer)
        .set(updates)
        .where(eq(customer.id, c.id))
        .returning();

      return {
        customer: {
          id: updated.id,
          email: updated.email,
          firstName: updated.firstName,
          lastName: updated.lastName,
          phone: updated.phone,
          emailVerified: updated.emailVerified,
          marketingOptin: updated.marketingOptin,
        },
      };
    },
    {
      customerAuth: true,
      cookie: customerCookieSchema,
      body: t.Object({
        firstName: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        lastName: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        phone: t.Optional(t.Nullable(t.String({ maxLength: 20 }))),
        marketingOptin: t.Optional(t.Boolean()),
      }),
      response: {
        200: 'CustomerAuth',
        401: unauthorizedResponse,
      },
    },
  );
