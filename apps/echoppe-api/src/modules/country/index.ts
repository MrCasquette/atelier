import { shippingCountry } from '@echoppe/core';
import { country } from '@repo/identity';
import { db, eq } from '@repo/db';
import { Elysia } from 'elysia';
import { withReadErrors } from '../../lib/response';
import { models } from '../../model';

// Schéma d'entité pays (Country, CountryList) → src/models/company.ts

export const countriesRoutes = new Elysia({ prefix: '/countries', detail: { tags: ['Countries'] } })
  // Registre central des modèles nommés → components.schemas.
  .use(models)

  // GET /countries - List shipping-enabled countries (public, for storefront address forms)
  .get(
    '/',
    async () => {
      // Table-ensemble (ADR-0034) : la présence d'une ligne dans `shipping_country` vaut
      // activation. `country` reste une donnée de référence neutre, partagée avec Prisme.
      return db
        .select({ id: country.id, name: country.name, code: country.code })
        .from(country)
        .innerJoin(shippingCountry, eq(shippingCountry.country, country.id))
        .orderBy(country.name);
    },
    { response: withReadErrors({ 200: 'CountryList' }) },
  );
