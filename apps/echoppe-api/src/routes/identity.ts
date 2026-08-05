import {
  country,
  db,
  eq,
  legalEntity,
  readStoreSettings,
  saveStoreSettings,
  site,
} from '@echoppe/core';
import { Elysia } from 'elysia';
import { withAuthErrors, withReadErrors } from '../lib/response';
import { models } from '../model';
import { identityBody } from '../models/identity';
import { getClientIp, logAudit } from '../modules/audit/service';
import { permissionGuard } from '../plugins/rbac';

// Identité du site et entité légale (ADR-0040) — remplace /company.
//
// Deux tables derrière une seule surface, parce qu'elles partagent un écran. La frontière métier
// n'est pas la frontière d'interface ; la séparation d'écran est un sujet à part.
//
// Schémas d'entité (Identity, Site, LegalEntity, Country, CountryList) → src/models/identity.ts

async function readIdentity() {
  const [siteData] = await db.select().from(site).limit(1);
  const [legal] = await db.select().from(legalEntity).limit(1);
  const { documentPrefix, invoicePrefix, taxExempt } = await readStoreSettings();

  return {
    site: siteData ?? null,
    legal: legal ?? null,
    settings: { documentPrefix, invoicePrefix, taxExempt },
  };
}

export const identityRoutes = new Elysia({ prefix: '/identity', detail: { tags: ['Identity'] } })
  // Registre central des modèles nommés → components.schemas.
  .use(models)

  // GET /identity - Public : identité du site et mentions légales
  .get('/', readIdentity, { response: withReadErrors({ 200: 'Identity' }) })

  // === ADMIN ROUTES ===
  .use(permissionGuard('identity', 'read'))

  // GET /identity/countries - Liste complète des pays, pour les sélecteurs d'administration
  .get(
    '/countries',
    async () => {
      return db.select().from(country).orderBy(country.name);
    },
    { permission: true, response: withAuthErrors({ 200: 'CountryList' }) },
  )

  .use(permissionGuard('identity', 'update'))

  // PUT /identity - Crée ou met à jour (upsert)
  .put(
    '/',
    async ({ body, currentUser, request }) => {
      const siteValues = {
        name: body.site.name,
        logo: body.site.logo ?? null,
        url: body.site.url ?? null,
        description: body.site.description ?? null,
        publicEmail: body.site.publicEmail ?? null,
        publicPhone: body.site.publicPhone ?? null,
        publisherName: body.site.publisherName ?? null,
        hostName: body.site.hostName ?? null,
        hostAddress: body.site.hostAddress ?? null,
        hostPhone: body.site.hostPhone ?? null,
      };

      const [existingSite] = await db.select({ id: site.id }).from(site).limit(1);
      if (existingSite) {
        await db.update(site).set(siteValues).where(eq(site.id, existingSite.id));
      } else {
        await db.insert(site).values(siteValues);
      }

      // `legal` absent → inchangé ; `legal: null` → supprimé ; sinon upsert.
      if (body.legal !== undefined) {
        const [existingLegal] = await db.select({ id: legalEntity.id }).from(legalEntity).limit(1);

        if (body.legal === null) {
          if (existingLegal) {
            await db.delete(legalEntity).where(eq(legalEntity.id, existingLegal.id));
          }
        } else {
          const legalValues = {
            name: body.legal.name,
            legalForm: body.legal.legalForm ?? null,
            siren: body.legal.siren ?? null,
            siret: body.legal.siret ?? null,
            tvaIntra: body.legal.tvaIntra ?? null,
            rcsCity: body.legal.rcsCity ?? null,
            shareCapital: body.legal.shareCapital ?? null,
            street: body.legal.street,
            street2: body.legal.street2 ?? null,
            postalCode: body.legal.postalCode,
            city: body.legal.city,
            country: body.legal.country ?? null,
          };

          if (existingLegal) {
            await db
              .update(legalEntity)
              .set(legalValues)
              .where(eq(legalEntity.id, existingLegal.id));
          } else {
            await db.insert(legalEntity).values(legalValues);
          }
        }
      }

      if (body.settings) {
        await saveStoreSettings({
          documentPrefix: body.settings.documentPrefix ?? 'REC',
          invoicePrefix: body.settings.invoicePrefix ?? 'FA',
          taxExempt: body.settings.taxExempt ?? false,
        });
      }

      const result = await readIdentity();

      logAudit({
        userId: currentUser?.id,
        action: 'identity.update',
        entityType: 'identity',
        entityId: result.site?.id,
        data: { name: result.site?.name },
        ipAddress: getClientIp(request.headers),
      });

      return result;
    },
    { permission: true, body: identityBody, response: withAuthErrors({ 200: 'Identity' }) },
  );
