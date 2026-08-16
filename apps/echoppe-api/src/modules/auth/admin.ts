import { faults } from '@echoppe/core';
import {
  authenticateAdmin,
  destroyAdminSession,
  readAdminSession,
  SESSION_DURATION_DAYS,
} from '@repo/auth';
import { Elysia, t } from 'elysia';
import { rateLimit } from 'elysia-rate-limit';
import { faultBody } from '../../lib/fault';
import { authRateLimitOptions, invitationRateLimitOptions } from '../../lib/rate-limit';
import { rateLimitResponse, successSchema } from '../../lib/response';
import { models } from '../../model';
import { getClientIp, logAudit } from '../audit/service';
import { consumePasswordToken } from '../user/invitation';
import { COOKIE_NAME, cookieSchema } from './session';

// Schema pour /auth/me (réponse)
const meUserSchema = t.Object({
  id: t.String(),
  email: t.String(),
  firstName: t.String(),
  lastName: t.String(),
  isOwner: t.Boolean(),
  isActive: t.Boolean(),
});

const meRoleSchema = t.Object({
  id: t.String(),
  name: t.String(),
  scope: t.String(),
});

const meResponseSchema = t.Object({
  user: meUserSchema,
  role: meRoleSchema,
});

// Schema pour /auth/login (réponse)
const loginUserSchema = t.Object({
  id: t.String(),
  email: t.String(),
  firstName: t.String(),
  lastName: t.String(),
});

const loginResponseSchema = t.Object({
  user: loginUserSchema,
});

// POST /auth/accept-invitation (ADR-0048) — consomme un jeton et pose le mot de passe.
//
// PUBLIQUE par nature : celui qui clique n'a pas de session, c'est précisément ce qu'il vient
// chercher. Elle n'entre pas dans la surface storefront, qui est une liste explicite.
//
// Rate-limitée comme une surface d'authentification — un jeton de 32 octets ne se devine pas, mais
// on ne laisse pas essayer. Compteur SÉPARÉ de la connexion : les partager rendrait les deux
// solidaires, et dix échecs de connexion empêcheraient un invité d'ouvrir son compte.
const acceptInvitationRoute = new Elysia()
  .use(models)
  .use(rateLimit(invitationRateLimitOptions))
  .post(
    '/accept-invitation',
    async ({ body, status }) => {
      const result = await consumePasswordToken(body.token, body.password);

      // Inconnu, consommé, périmé : une seule réponse. Distinguer dirait à un attaquant lequel des
      // trois, donc si le jeton a existé.
      if (result.outcome === 'invalid-token') {
        return status(400, faultBody(faults.invalidToken()));
      }

      logAudit({
        userId: result.userId,
        action: 'user.password_set',
        entityType: 'user',
        entityId: result.userId,
      });

      return { success: true };
    },
    {
      body: t.Object({
        token: t.String({ minLength: 32, maxLength: 128 }),
        password: t.String({ minLength: 6 }),
      }),
      response: {
        200: successSchema,
        400: 'ErrorResponse',
        429: rateLimitResponse,
      },
    },
  );

// Rate-limited login route (separate instance for scoped rate limiting)
const loginRoute = new Elysia()
  .use(models)
  .use(rateLimit(authRateLimitOptions))
  .post(
    '/login',
    async ({ body, cookie, request, status }) => {
      const ipAddress =
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      const result = await authenticateAdmin(body, { ipAddress, userAgent });

      if (result.outcome === 'invalid-credentials') {
        return status(401, faultBody(faults.invalidCredentials()));
      }
      if (result.outcome === 'account-disabled') {
        // L'état du compte, pas les identifiants : `invalid_state` dit lequel et lequel il faudrait.
        // Rendu APRÈS la vérification du mot de passe le jour où le jalon 1 fermera cet oracle —
        // la faute ne changera pas, seulement le moment où elle sort.
        return status(403, faultBody(faults.invalidState('user', 'disabled', 'active')));
      }

      cookie[COOKIE_NAME].set({
        value: result.token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
      });

      logAudit({
        userId: result.user.id,
        action: 'user.login',
        entityType: 'user',
        entityId: result.user.id,
        ipAddress: ipAddress !== 'unknown' ? ipAddress : undefined,
      });

      return { user: result.user };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 1 }),
      }),
      cookie: cookieSchema,
      response: {
        200: loginResponseSchema,
        401: 'ErrorResponse',
        403: 'ErrorResponse',
        429: rateLimitResponse,
      },
    },
  );

export const authAdminRoutes = new Elysia({ prefix: '/auth', detail: { tags: ['Auth'] } })
  .use(models)

  // GET /auth/me - NO rate limit
  .get(
    '/me',
    async ({ cookie, status }) => {
      const token = cookie[COOKIE_NAME].value;
      if (!token) return status(401, faultBody(faults.unauthenticated()));

      const result = await readAdminSession(token);

      // Une session refusée ne doit pas laisser traîner son cookie : le client repart propre.
      if (result.outcome === 'invalid') {
        cookie[COOKIE_NAME].remove();
        return status(401, faultBody(faults.invalidToken()));
      }
      if (result.outcome === 'account-disabled') {
        cookie[COOKIE_NAME].remove();
        return status(403, faultBody(faults.invalidState('user', 'disabled', 'active')));
      }

      return { user: result.user, role: result.role };
    },
    {
      cookie: cookieSchema,
      response: {
        200: meResponseSchema,
        401: 'ErrorResponse',
        403: 'ErrorResponse',
      },
    },
  )

  // POST /auth/logout - NO rate limit
  .post(
    '/logout',
    async ({ cookie, request }) => {
      const userId = await destroyAdminSession(cookie[COOKIE_NAME].value);

      if (userId) {
        logAudit({
          userId,
          action: 'user.logout',
          entityType: 'user',
          entityId: userId,
          ipAddress: getClientIp(request.headers),
        });
      }

      cookie[COOKIE_NAME].remove();

      return { success: true };
    },
    {
      cookie: cookieSchema,
      response: { 200: successSchema },
    },
  )

  // POST /auth/login - WITH rate limit (scoped instance)
  .use(loginRoute)
  .use(acceptInvitationRoute);
