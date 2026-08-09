import { Elysia } from 'elysia';
import { withAuthErrors, withReadErrors } from '../../lib/response';
import { models } from '../../model';
import { getClientIp, logAudit } from '../audit/service';
import { permissionGuard } from '../auth/rbac';
import { identityBody } from './model';
import { listCountries, readIdentity, saveIdentity } from './service';

// Identité du site et entité légale (ADR-0040) — remplace /company.
//
// Deux tables derrière une seule surface, parce qu'elles partagent un écran. La frontière métier
// n'est pas la frontière d'interface ; la séparation d'écran est un sujet à part.
//
// Schémas d'entité (Identity, Site, LegalEntity, Country, CountryList) → ./model.ts
// Logique (lecture, upsert, pays) → ./service.ts

export const identityRoutes = new Elysia({ prefix: '/identity', detail: { tags: ['Identity'] } })
  // Registre central des modèles nommés → components.schemas.
  .use(models)

  // GET /identity - Public : identité du site et mentions légales
  .get('/', () => readIdentity(), { response: withReadErrors({ 200: 'Identity' }) })

  // === ADMIN ROUTES ===
  .use(permissionGuard('identity', 'read'))

  // GET /identity/countries - Liste complète des pays, pour les sélecteurs d'administration
  .get('/countries', () => listCountries(), {
    permission: true,
    response: withAuthErrors({ 200: 'CountryList' }),
  })

  .use(permissionGuard('identity', 'update'))

  // PUT /identity - Crée ou met à jour (upsert)
  .put(
    '/',
    async ({ body, currentUser, request }) => {
      const result = await saveIdentity(body);

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
