import {
  type ColissimoCredentials,
  db,
  eq,
  getShippingAdapter,
  getShippingProviderStatus,
  isEncryptionConfigured,
  type MondialRelayCredentials,
  order,
  resetShippingAdapters,
  type SendcloudCredentials,
  SHIPPING_PROVIDERS,
  type ShippingProvider,
  saveShippingProviderCredentials,
  shipment,
  shippingProvider,
} from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { permissionGuard } from '../plugins/rbac';
import { errorSchema, successSchema, withAuthErrors } from '../utils/responses';

const colissimoConfigBody = t.Object({
  contractNumber: t.String({ minLength: 1 }),
  password: t.String({ minLength: 1 }),
  isEnabled: t.Optional(t.Boolean()),
});

const mondialrelayConfigBody = t.Object({
  brandId: t.String({ minLength: 1 }),
  login: t.String({ minLength: 1 }),
  password: t.String({ minLength: 1 }),
  isEnabled: t.Optional(t.Boolean()),
});

const sendcloudConfigBody = t.Object({
  apiKey: t.String({ minLength: 1 }),
  apiSecret: t.String({ minLength: 1 }),
  isEnabled: t.Optional(t.Boolean()),
});

const ratesBody = t.Object({
  weight: t.Number({ minimum: 1 }),
  fromPostalCode: t.String({ minLength: 1 }),
  fromCountry: t.String({ minLength: 2, maxLength: 2 }),
  toPostalCode: t.String({ minLength: 1 }),
  toCountry: t.String({ minLength: 2, maxLength: 2 }),
});

const labelBody = t.Object({
  orderId: t.String({ format: 'uuid' }),
  weight: t.Number({ minimum: 1 }),
  // Littéraux explicites (l'inférence Eden exige des TLiteral précis) — garder en phase avec SHIPPING_PROVIDERS.
  provider: t.Union([t.Literal('colissimo'), t.Literal('mondialrelay'), t.Literal('sendcloud')]),
  service: t.Optional(t.String()),
  sender: t.Object({
    name: t.String(),
    company: t.Optional(t.String()),
    street1: t.String(),
    street2: t.Optional(t.String()),
    city: t.String(),
    postalCode: t.String(),
    country: t.String({ minLength: 2, maxLength: 2 }),
    phone: t.Optional(t.String()),
    email: t.Optional(t.String()),
  }),
  recipient: t.Object({
    name: t.String(),
    company: t.Optional(t.String()),
    street1: t.String(),
    street2: t.Optional(t.String()),
    city: t.String(),
    postalCode: t.String(),
    country: t.String({ minLength: 2, maxLength: 2 }),
    phone: t.Optional(t.String()),
    email: t.Optional(t.String()),
  }),
});

// Response schemas

const providerFieldSchema = t.Object({
  key: t.String(),
  label: t.String(),
  type: t.String(),
  placeholder: t.Optional(t.String()),
});

const shippingProviderStatusSchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.String(),
  fields: t.Array(providerFieldSchema),
  isConfigured: t.Boolean(),
  isEnabled: t.Boolean(),
  encryptionReady: t.Boolean(),
});

const rateSchema = t.Object({
  id: t.String(),
  carrier: t.String(),
  service: t.String(),
  price: t.Number(),
  currency: t.String(),
  deliveryDays: t.Object({
    min: t.Number(),
    max: t.Number(),
  }),
});

const labelSchema = t.Object({
  trackingNumber: t.String(),
  trackingUrl: t.Optional(t.String()),
  labelUrl: t.Optional(t.String()),
  labelData: t.Optional(t.String()),
});

const trackingEventSchema = t.Object({
  date: t.Date(),
  status: t.String(),
  description: t.String(),
  location: t.Optional(t.String()),
});

const providerMeta: Record<
  ShippingProvider,
  {
    name: string;
    description: string;
    fields: { key: string; label: string; type: string; placeholder?: string }[];
  }
> = {
  colissimo: {
    name: 'Colissimo',
    description: 'La Poste - Livraison à domicile France',
    fields: [
      { key: 'contractNumber', label: 'N° de contrat', type: 'text', placeholder: '123456' },
      { key: 'password', label: 'Mot de passe', type: 'password' },
    ],
  },
  mondialrelay: {
    name: 'Mondial Relay',
    description: 'Livraison en point relais',
    fields: [
      { key: 'brandId', label: 'Code Enseigne', type: 'text', placeholder: 'BDTEST' },
      { key: 'login', label: 'Login', type: 'text' },
      { key: 'password', label: 'Mot de passe', type: 'password' },
    ],
  },
  sendcloud: {
    name: 'Sendcloud',
    description: 'Multi-transporteurs (Colissimo, DHL, UPS...)',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text' },
      { key: 'apiSecret', label: 'API Secret', type: 'password' },
    ],
  },
};

export const shippingRoutes = new Elysia({ prefix: '/shipping', detail: { tags: ['Shipping'] } })

  // === SHIPPING PROVIDER READ ===
  .use(permissionGuard('shipping_provider', 'read'))

  // GET /shipping/providers - Liste des providers avec statut
  .get(
    '/providers',
    async () => {
      const providers = SHIPPING_PROVIDERS;
      const encryptionReady = isEncryptionConfigured();

      const result = await Promise.all(
        providers.map(async (id) => {
          const status = await getShippingProviderStatus(id);
          return {
            id,
            ...providerMeta[id],
            ...status,
            encryptionReady,
          };
        }),
      );

      return result;
    },
    { permission: true, response: { 200: t.Array(shippingProviderStatusSchema) } },
  )

  // POST /shipping/rates - Calcul des tarifs
  .post(
    '/rates',
    async ({ body }) => {
      const providers = SHIPPING_PROVIDERS;
      const allRates = [];

      for (const provider of providers) {
        try {
          const adapter = getShippingAdapter(provider);
          if (await adapter.isConfigured()) {
            const rates = await adapter.getRates(body);
            allRates.push(...rates);
          }
        } catch (error) {
          console.error(`Error getting rates from ${provider}:`, error);
        }
      }

      return allRates.sort((a, b) => a.price - b.price);
    },
    { permission: true, body: ratesBody, response: withAuthErrors({ 200: t.Array(rateSchema) }) },
  )

  // GET /shipping/tracking/:trackingNumber
  .get(
    '/tracking/:trackingNumber',
    async ({ params, query, status }) => {
      const provider = query.provider as ShippingProvider | undefined;

      if (!provider) {
        return status(400, { message: 'Provider requis (?provider=colissimo)' });
      }

      const adapter = getShippingAdapter(provider);

      if (!(await adapter.isConfigured())) {
        return status(400, { message: `Provider ${provider} non configuré` });
      }

      const events = await adapter.getTracking(params.trackingNumber);
      return events;
    },
    {
      permission: true,
      params: t.Object({ trackingNumber: t.String() }),
      query: t.Object({ provider: t.Optional(t.String()) }),
      response: { 200: t.Array(trackingEventSchema), 400: errorSchema },
    },
  )

  // === SHIPPING PROVIDER UPDATE ===
  .use(permissionGuard('shipping_provider', 'update'))

  // PUT /shipping/providers/colissimo
  .put(
    '/providers/colissimo',
    async ({ body, status }) => {
      if (!isEncryptionConfigured()) {
        return status(400, { message: 'ENCRYPTION_KEY non configurée' });
      }

      const credentials: ColissimoCredentials = {
        contractNumber: body.contractNumber,
        password: body.password,
      };

      await saveShippingProviderCredentials('colissimo', credentials, body.isEnabled ?? true);
      resetShippingAdapters();

      return { success: true };
    },
    {
      permission: true,
      body: colissimoConfigBody,
      response: { 200: successSchema, 400: errorSchema },
    },
  )

  // PUT /shipping/providers/mondialrelay
  .put(
    '/providers/mondialrelay',
    async ({ body, status }) => {
      if (!isEncryptionConfigured()) {
        return status(400, { message: 'ENCRYPTION_KEY non configurée' });
      }

      const credentials: MondialRelayCredentials = {
        brandId: body.brandId,
        login: body.login,
        password: body.password,
      };

      await saveShippingProviderCredentials('mondialrelay', credentials, body.isEnabled ?? true);
      resetShippingAdapters();

      return { success: true };
    },
    {
      permission: true,
      body: mondialrelayConfigBody,
      response: { 200: successSchema, 400: errorSchema },
    },
  )

  // PUT /shipping/providers/sendcloud
  .put(
    '/providers/sendcloud',
    async ({ body, status }) => {
      if (!isEncryptionConfigured()) {
        return status(400, { message: 'ENCRYPTION_KEY non configurée' });
      }

      const credentials: SendcloudCredentials = {
        apiKey: body.apiKey,
        apiSecret: body.apiSecret,
      };

      await saveShippingProviderCredentials('sendcloud', credentials, body.isEnabled ?? true);
      resetShippingAdapters();

      return { success: true };
    },
    {
      permission: true,
      body: sendcloudConfigBody,
      response: { 200: successSchema, 400: errorSchema },
    },
  )

  // === SHIPPING LABEL CREATE (uses order:update since it's part of order fulfillment) ===
  .use(permissionGuard('order', 'update'))

  // POST /shipping/labels - Créer une étiquette
  .post(
    '/labels',
    async ({ body, status }) => {
      const adapter = getShippingAdapter(body.provider);

      if (!(await adapter.isConfigured())) {
        return status(400, { message: `Provider ${body.provider} non configuré` });
      }

      // Vérifier que la commande existe
      const [orderData] = await db.select().from(order).where(eq(order.id, body.orderId));

      if (!orderData) {
        return status(404, { message: 'Commande introuvable' });
      }

      // Récupérer ou créer le shipping provider
      let [providerRecord] = await db
        .select()
        .from(shippingProvider)
        .where(eq(shippingProvider.type, body.provider));

      if (!providerRecord) {
        const providerNames: Record<ShippingProvider, string> = {
          colissimo: 'Colissimo',
          mondialrelay: 'Mondial Relay',
          sendcloud: 'Sendcloud',
        };

        [providerRecord] = await db
          .insert(shippingProvider)
          .values({
            name: providerNames[body.provider],
            type: body.provider,
            isEnabled: true,
          })
          .returning();
      }

      const label = await adapter.createLabel({
        orderId: body.orderId,
        weight: body.weight,
        sender: body.sender,
        recipient: body.recipient,
        service: body.service,
      });

      // Créer l'entrée shipment
      await db.insert(shipment).values({
        order: body.orderId,
        provider: providerRecord.id,
        status: 'label_created',
        trackingNumber: label.trackingNumber,
        trackingUrl: label.trackingUrl,
        weight: (body.weight / 1000).toString(),
      });

      return label;
    },
    {
      permission: true,
      body: labelBody,
      response: { 200: labelSchema, 400: errorSchema, 404: errorSchema },
    },
  );
