import { address, and, country, db, eq } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { models } from '../models';
import {
  customerAuthPlugin,
  customerCookieSchema,
  type SessionCustomer,
} from '../plugins/customerAuth';
import { errorSchema, successSchema } from '../utils/responses';

// Schéma d'entité adresse (Address, AddressList) → src/models/address.ts

const addressBodySchema = t.Object({
  type: t.Union([t.Literal('shipping'), t.Literal('billing')]),
  label: t.Optional(t.String({ maxLength: 50 })),
  firstName: t.String({ minLength: 1, maxLength: 100 }),
  lastName: t.String({ minLength: 1, maxLength: 100 }),
  company: t.Optional(t.String({ maxLength: 100 })),
  street: t.String({ minLength: 1, maxLength: 255 }),
  street2: t.Optional(t.String({ maxLength: 255 })),
  postalCode: t.String({ minLength: 1, maxLength: 10 }),
  city: t.String({ minLength: 1, maxLength: 100 }),
  countryId: t.String({ format: 'uuid' }),
  phone: t.Optional(t.String({ maxLength: 20 })),
  isDefault: t.Optional(t.Boolean()),
});

export const customerAddressesRoutes = new Elysia({
  prefix: '/customer/addresses',
  detail: { tags: ['Customer Addresses'] },
})
  .use(customerAuthPlugin)
  // Registre central des modèles nommés → components.schemas.
  .use(models)

  // GET /customer/addresses - List all addresses
  .get(
    '/',
    async ({ currentCustomer }) => {
      const customer = currentCustomer as SessionCustomer;

      const addresses = await db
        .select({
          id: address.id,
          type: address.type,
          label: address.label,
          firstName: address.firstName,
          lastName: address.lastName,
          company: address.company,
          street: address.street,
          street2: address.street2,
          postalCode: address.postalCode,
          city: address.city,
          country: {
            id: country.id,
            name: country.name,
            code: country.code,
          },
          phone: address.phone,
          isDefault: address.isDefault,
        })
        .from(address)
        .innerJoin(country, eq(address.country, country.id))
        .where(eq(address.customer, customer.id));

      return addresses;
    },
    {
      customerAuth: true,
      cookie: customerCookieSchema,
      response: { 200: 'AddressList' },
    },
  )

  // GET /customer/addresses/:id - Get single address
  .get(
    '/:id',
    async ({ params, currentCustomer, status }) => {
      const customer = currentCustomer as SessionCustomer;

      const [addressData] = await db
        .select({
          id: address.id,
          type: address.type,
          label: address.label,
          firstName: address.firstName,
          lastName: address.lastName,
          company: address.company,
          street: address.street,
          street2: address.street2,
          postalCode: address.postalCode,
          city: address.city,
          country: {
            id: country.id,
            name: country.name,
            code: country.code,
          },
          phone: address.phone,
          isDefault: address.isDefault,
        })
        .from(address)
        .innerJoin(country, eq(address.country, country.id))
        .where(and(eq(address.id, params.id), eq(address.customer, customer.id)));

      if (!addressData) {
        return status(404, { message: 'Adresse introuvable' });
      }

      return addressData;
    },
    {
      customerAuth: true,
      cookie: customerCookieSchema,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: { 200: 'Address', 404: errorSchema },
    },
  )

  // POST /customer/addresses - Create address
  .post(
    '/',
    async ({ body, currentCustomer, status }) => {
      const customer = currentCustomer as SessionCustomer;

      // Verify country exists
      const [countryData] = await db
        .select({ id: country.id, name: country.name, code: country.code })
        .from(country)
        .where(eq(country.id, body.countryId));

      if (!countryData) {
        return status(400, { message: 'Pays introuvable' });
      }

      // If this is set as default, unset other defaults of same type
      if (body.isDefault) {
        await db
          .update(address)
          .set({ isDefault: false })
          .where(and(eq(address.customer, customer.id), eq(address.type, body.type)));
      }

      // Create address
      const [created] = await db
        .insert(address)
        .values({
          customer: customer.id,
          type: body.type,
          label: body.label,
          firstName: body.firstName,
          lastName: body.lastName,
          company: body.company,
          street: body.street,
          street2: body.street2,
          postalCode: body.postalCode,
          city: body.city,
          country: body.countryId,
          phone: body.phone,
          isDefault: body.isDefault ?? false,
        })
        .returning();

      return {
        id: created.id,
        type: created.type,
        label: created.label,
        firstName: created.firstName,
        lastName: created.lastName,
        company: created.company,
        street: created.street,
        street2: created.street2,
        postalCode: created.postalCode,
        city: created.city,
        country: countryData,
        phone: created.phone,
        isDefault: created.isDefault,
      };
    },
    {
      customerAuth: true,
      cookie: customerCookieSchema,
      body: addressBodySchema,
      response: { 200: 'Address', 400: errorSchema },
    },
  )

  // PUT /customer/addresses/:id - Update address
  .put(
    '/:id',
    async ({ params, body, currentCustomer, status }) => {
      const customer = currentCustomer as SessionCustomer;

      // Check address belongs to customer
      const [existing] = await db
        .select({ id: address.id })
        .from(address)
        .where(and(eq(address.id, params.id), eq(address.customer, customer.id)));

      if (!existing) {
        return status(404, { message: 'Adresse introuvable' });
      }

      // Verify country exists
      const [countryData] = await db
        .select({ id: country.id, name: country.name, code: country.code })
        .from(country)
        .where(eq(country.id, body.countryId));

      if (!countryData) {
        return status(400, { message: 'Pays introuvable' });
      }

      // If this is set as default, unset other defaults of same type
      if (body.isDefault) {
        await db
          .update(address)
          .set({ isDefault: false })
          .where(and(eq(address.customer, customer.id), eq(address.type, body.type)));
      }

      // Update address
      const [updated] = await db
        .update(address)
        .set({
          type: body.type,
          label: body.label,
          firstName: body.firstName,
          lastName: body.lastName,
          company: body.company,
          street: body.street,
          street2: body.street2,
          postalCode: body.postalCode,
          city: body.city,
          country: body.countryId,
          phone: body.phone,
          isDefault: body.isDefault ?? false,
        })
        .where(eq(address.id, params.id))
        .returning();

      return {
        id: updated.id,
        type: updated.type,
        label: updated.label,
        firstName: updated.firstName,
        lastName: updated.lastName,
        company: updated.company,
        street: updated.street,
        street2: updated.street2,
        postalCode: updated.postalCode,
        city: updated.city,
        country: countryData,
        phone: updated.phone,
        isDefault: updated.isDefault,
      };
    },
    {
      customerAuth: true,
      cookie: customerCookieSchema,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      body: addressBodySchema,
      response: { 200: 'Address', 400: errorSchema, 404: errorSchema },
    },
  )

  // DELETE /customer/addresses/:id - Delete address
  .delete(
    '/:id',
    async ({ params, currentCustomer, status }) => {
      const customer = currentCustomer as SessionCustomer;

      // Check address belongs to customer
      const [existing] = await db
        .select({ id: address.id })
        .from(address)
        .where(and(eq(address.id, params.id), eq(address.customer, customer.id)));

      if (!existing) {
        return status(404, { message: 'Adresse introuvable' });
      }

      await db.delete(address).where(eq(address.id, params.id));

      return { success: true };
    },
    {
      customerAuth: true,
      cookie: customerCookieSchema,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: { 200: successSchema, 404: errorSchema },
    },
  );
