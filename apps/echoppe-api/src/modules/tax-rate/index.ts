import { db, taxRate } from '@echoppe/core';
import { Elysia } from 'elysia';
import { withReadErrors } from '../../lib/response';
import { models } from '../../model';

// Schéma d'entité taux de TVA (TaxRate, TaxRateList) → ./model.ts

export const taxRatesRoutes = new Elysia({ prefix: '/tax-rates', detail: { tags: ['Tax Rates'] } })
  // Registre central des modèles nommés → components.schemas.
  .use(models)

  // GET /tax-rates - List all (public for forms)
  .get(
    '/',
    async () => {
      const rates = await db.select().from(taxRate);
      return rates;
    },
    { response: withReadErrors({ 200: 'TaxRateList' }) },
  );
