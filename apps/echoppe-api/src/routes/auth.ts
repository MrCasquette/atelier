import { randomBytes } from 'node:crypto';
import { and, db, eq, gt, role, session, user } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { rateLimit } from 'elysia-rate-limit';
import { getClientIp, logAudit } from '../lib/audit';
import { authRateLimitOptions } from '../utils/rate-limit';
import {
  forbiddenResponse,
  rateLimitResponse,
  successSchema,
  unauthorizedResponse,
} from '../utils/responses';

const COOKIE_NAME = 'echoppe_admin_session';
const SESSION_DURATION_DAYS = 7;

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function getExpiresAt(): Date {
  const date = new Date();
  date.setDate(date.getDate() + SESSION_DURATION_DAYS);
  return date;
}

// Schema cookie pour le typage
const cookieSchema = t.Cookie({
  [COOKIE_NAME]: t.Optional(t.String()),
});

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
    // Find user by email
    const [foundUser] = await db
      .select({
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
      })
      .from(user)
      .where(eq(user.email, body.email.toLowerCase()));

    if (!foundUser) {
      return status(401, { message: 'Email ou mot de passe incorrect' });
    }

    if (!foundUser.isActive) {
      return status(403, { message: 'Compte désactivé' });
    }

    // Verify password
    const validPassword = await Bun.password.verify(body.password, foundUser.passwordHash);
    if (!validPassword) {
      return status(401, { message: 'Email ou mot de passe incorrect' });
    }

    // Create session
    const token = generateToken();
    const expiresAt = getExpiresAt();
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await db.insert(session).values({
      token,
      user: foundUser.id,
      ipAddress,
      userAgent,
      expiresAt,
    });

    // Update last login
    await db.update(user).set({ lastLogin: new Date() }).where(eq(user.id, foundUser.id));

    // Set cookie
    cookie[COOKIE_NAME].set({
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    });

    // Log successful login
    logAudit({
      userId: foundUser.id,
      action: 'user.login',
      entityType: 'user',
      entityId: foundUser.id,
      ipAddress: ipAddress !== 'unknown' ? ipAddress : undefined,
    });

    return {
      user: {
        id: foundUser.id,
        email: foundUser.email,
        firstName: foundUser.firstName,
        lastName: foundUser.lastName,
      },
    };
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

export const authRoutes = new Elysia({ prefix: '/auth', detail: { tags: ['Auth'] } })

  // GET /auth/me - NO rate limit
  .get(
    '/me',
    async ({ cookie, status }) => {
      const token = cookie[COOKIE_NAME].value;

      if (!token) {
        return status(401, { message: 'Non authentifié' });
      }

      // Find valid session with user and role
      const [sessionData] = await db
        .select({
          session: {
            id: session.id,
            expiresAt: session.expiresAt,
          },
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            isOwner: user.isOwner,
            isActive: user.isActive,
          },
          role: {
            id: role.id,
            name: role.name,
            scope: role.scope,
          },
        })
        .from(session)
        .innerJoin(user, eq(session.user, user.id))
        .innerJoin(role, eq(user.role, role.id))
        .where(and(eq(session.token, token), gt(session.expiresAt, new Date())));

      if (!sessionData) {
        cookie[COOKIE_NAME].remove();
        return status(401, { message: 'Session invalide ou expirée' });
      }

      if (!sessionData.user.isActive) {
        cookie[COOKIE_NAME].remove();
        return status(403, { message: 'Compte désactivé' });
      }

      return {
        user: sessionData.user,
        role: sessionData.role,
      };
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
      const token = cookie[COOKIE_NAME].value;

      if (token) {
        // Get user ID before deleting session for audit
        const [sessionData] = await db
          .select({ userId: session.user })
          .from(session)
          .where(eq(session.token, token));

        // Delete session from DB
        await db.delete(session).where(eq(session.token, token));

        // Log logout
        if (sessionData) {
          logAudit({
            userId: sessionData.userId,
            action: 'user.logout',
            entityType: 'user',
            entityId: sessionData.userId,
            ipAddress: getClientIp(request.headers),
          });
        }
      }

      // Clear cookie
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
