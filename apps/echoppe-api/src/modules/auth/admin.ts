import {
  authenticateAdmin,
  destroyAdminSession,
  readAdminSession,
  SESSION_DURATION_DAYS,
} from '@repo/auth';
import { Elysia, t } from 'elysia';
import { rateLimit } from 'elysia-rate-limit';
import { authRateLimitOptions } from '../../lib/rate-limit';
import {
  forbiddenResponse,
  rateLimitResponse,
  successSchema,
  unauthorizedResponse,
} from '../../lib/response';
import { getClientIp, logAudit } from '../audit/service';
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

// Rate-limited login route (separate instance for scoped rate limiting)
const loginRoute = new Elysia().use(rateLimit(authRateLimitOptions)).post(
  '/login',
  async ({ body, cookie, request, status }) => {
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const result = await authenticateAdmin(body, { ipAddress, userAgent });

    if (result.outcome === 'invalid-credentials') {
      return status(401, { message: 'Email ou mot de passe incorrect' });
    }
    if (result.outcome === 'account-disabled') {
      return status(403, { message: 'Compte désactivé' });
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
      401: unauthorizedResponse,
      403: forbiddenResponse,
      429: rateLimitResponse,
    },
  },
);

export const authAdminRoutes = new Elysia({ prefix: '/auth', detail: { tags: ['Auth'] } })

  // GET /auth/me - NO rate limit
  .get(
    '/me',
    async ({ cookie, status }) => {
      const token = cookie[COOKIE_NAME].value;
      if (!token) return status(401, { message: 'Non authentifié' });

      const result = await readAdminSession(token);

      // Une session refusée ne doit pas laisser traîner son cookie : le client repart propre.
      if (result.outcome === 'invalid') {
        cookie[COOKIE_NAME].remove();
        return status(401, { message: 'Session invalide ou expirée' });
      }
      if (result.outcome === 'account-disabled') {
        cookie[COOKIE_NAME].remove();
        return status(403, { message: 'Compte désactivé' });
      }

      return { user: result.user, role: result.role };
    },
    {
      cookie: cookieSchema,
      response: {
        200: meResponseSchema,
        401: unauthorizedResponse,
        403: forbiddenResponse,
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
  .use(loginRoute);
