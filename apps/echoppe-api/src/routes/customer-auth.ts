import { createHash, randomBytes } from 'node:crypto';
import {
  and,
  customer,
  customerSession,
  db,
  eq,
  gt,
  ne,
  passwordResetToken,
  sendResetPasswordEmail,
  sendWelcomeEmail,
} from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { rateLimit } from 'elysia-rate-limit';
import { PASSWORD_RESET_PATH, STOREFRONT_URL } from '../lib/config';
import { models } from '../models';
import { customerAuthPlugin, type SessionCustomer } from '../plugins/customerAuth';
import { authRateLimitOptions, strictRateLimitOptions } from '../utils/rate-limit';
import {
  conflictResponse,
  errorSchema,
  rateLimitResponse,
  successSchema,
  unauthorizedResponse,
} from '../utils/responses';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 heure
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

const COOKIE_NAME = 'echoppe_customer_session';
const SESSION_DURATION_DAYS = 7;

const cookieSchema = t.Cookie({
  [COOKIE_NAME]: t.Optional(t.String()),
});

// Les réponses sont des modèles nommés (src/models/customer.ts), référencés par nom :
// register/`me` → `CustomerAuth` (profil complet), login → `LoginResult` (identité réduite).
// Chaque instance qui les référence fait `.use(models)`.

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function getExpiresAt(): Date {
  const date = new Date();
  date.setDate(date.getDate() + SESSION_DURATION_DAYS);
  return date;
}

// Rate-limited register route (strict: 5 requests / 15 min)
const registerRoute = new Elysia()
  .use(rateLimit(strictRateLimitOptions))
  .use(models)
  .post(
    '/register',
    async ({ body, cookie, request, status }) => {
      // Check if email already exists
      const [existing] = await db
        .select({ id: customer.id })
        .from(customer)
        .where(eq(customer.email, body.email.toLowerCase()));

      if (existing) {
        return status(409, { message: 'Un compte existe déjà avec cet email' });
      }

      // Hash password
      const passwordHash = await Bun.password.hash(body.password, {
        algorithm: 'bcrypt',
        cost: 10,
      });

      // Create customer
      const [created] = await db
        .insert(customer)
        .values({
          email: body.email.toLowerCase(),
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone,
          marketingOptin: body.marketingOptin ?? false,
        })
        .returning();

      // Create session
      const token = generateToken();
      const expiresAt = getExpiresAt();
      const ipAddress =
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      await db.insert(customerSession).values({
        token,
        customer: created.id,
        ipAddress,
        userAgent,
        expiresAt,
      });

      // Update lastLogin
      await db.update(customer).set({ lastLogin: new Date() }).where(eq(customer.id, created.id));

      // Send welcome email
      await sendWelcomeEmail({
        customerEmail: created.email,
        customerName: created.firstName,
      });

      // Set cookie
      cookie[COOKIE_NAME].set({
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
      });

      return {
        customer: {
          id: created.id,
          email: created.email,
          firstName: created.firstName,
          lastName: created.lastName,
          phone: created.phone,
          emailVerified: created.emailVerified,
          marketingOptin: created.marketingOptin,
        },
      };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8 }),
        firstName: t.String({ minLength: 1, maxLength: 100 }),
        lastName: t.String({ minLength: 1, maxLength: 100 }),
        phone: t.Optional(t.String({ maxLength: 20 })),
        marketingOptin: t.Optional(t.Boolean()),
      }),
      cookie: cookieSchema,
      response: {
        200: 'CustomerAuth',
        409: conflictResponse,
        429: rateLimitResponse,
      },
    },
  );

// Rate-limited login route (auth: 10 requests / 15 min)
const loginRoute = new Elysia()
  .use(rateLimit(authRateLimitOptions))
  .use(models)
  .post(
    '/login',
    async ({ body, cookie, request, status }) => {
      const [found] = await db
        .select({
          id: customer.id,
          email: customer.email,
          passwordHash: customer.passwordHash,
          firstName: customer.firstName,
          lastName: customer.lastName,
        })
        .from(customer)
        .where(eq(customer.email, body.email.toLowerCase()));

      if (!found) {
        return status(401, { message: 'Email ou mot de passe incorrect' });
      }

      const validPassword = await Bun.password.verify(body.password, found.passwordHash);

      if (!validPassword) {
        return status(401, { message: 'Email ou mot de passe incorrect' });
      }

      // Create session
      const token = generateToken();
      const expiresAt = getExpiresAt();
      const ipAddress =
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      await db.insert(customerSession).values({
        token,
        customer: found.id,
        ipAddress,
        userAgent,
        expiresAt,
      });

      // Update lastLogin
      await db.update(customer).set({ lastLogin: new Date() }).where(eq(customer.id, found.id));

      // Set cookie
      cookie[COOKIE_NAME].set({
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
      });

      return {
        customer: {
          id: found.id,
          email: found.email,
          firstName: found.firstName,
          lastName: found.lastName,
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
        200: 'LoginResult',
        401: unauthorizedResponse,
        429: rateLimitResponse,
      },
    },
  );

// Réinitialisation de mot de passe oublié (public, rate-limited). Deux étapes :
// - forgot : crée un jeton (hash stocké, brut envoyé par email). Réponse TOUJOURS 200
//   (anti-énumération : ne révèle pas si l'email existe).
// - reset : consomme le jeton (usage unique, non expiré) → change le mdp, révoque toutes
//   les sessions du client.
const passwordResetRoutes = new Elysia()
  .use(rateLimit(strictRateLimitOptions))
  .post(
    '/password/forgot',
    async ({ body }) => {
      const [found] = await db
        .select({ id: customer.id, email: customer.email })
        .from(customer)
        .where(eq(customer.email, body.email.toLowerCase()));

      if (found) {
        const rawToken = generateToken();
        await db.insert(passwordResetToken).values({
          customer: found.id,
          tokenHash: sha256(rawToken),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        });

        const resetUrl = `${STOREFRONT_URL}${PASSWORD_RESET_PATH}?token=${rawToken}`;
        await sendResetPasswordEmail({ email: found.email, resetUrl, expiresIn: '1 heure' });
      }

      // Réponse identique que l'email existe ou non.
      return { success: true };
    },
    {
      body: t.Object({ email: t.String({ format: 'email' }) }),
      response: { 200: successSchema, 429: rateLimitResponse },
    },
  )
  .post(
    '/password/reset',
    async ({ body, status }) => {
      const [tokenRow] = await db
        .select({
          id: passwordResetToken.id,
          customer: passwordResetToken.customer,
          expiresAt: passwordResetToken.expiresAt,
          usedAt: passwordResetToken.usedAt,
        })
        .from(passwordResetToken)
        .where(eq(passwordResetToken.tokenHash, sha256(body.token)));

      if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt < new Date()) {
        return status(400, { message: 'Lien de réinitialisation invalide ou expiré' });
      }

      const passwordHash = await Bun.password.hash(body.newPassword, {
        algorithm: 'bcrypt',
        cost: 10,
      });

      await db
        .update(customer)
        .set({ passwordHash, dateUpdated: new Date() })
        .where(eq(customer.id, tokenRow.customer));

      // Jeton consommé + révocation de toutes les sessions (sécurité).
      await db
        .update(passwordResetToken)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetToken.id, tokenRow.id));
      await db.delete(customerSession).where(eq(customerSession.customer, tokenRow.customer));

      return { success: true };
    },
    {
      body: t.Object({
        token: t.String({ minLength: 1 }),
        newPassword: t.String({ minLength: 8 }),
      }),
      response: { 200: successSchema, 400: errorSchema, 429: rateLimitResponse },
    },
  );

export const customerAuthRoutes = new Elysia({
  prefix: '/customer/auth',
  detail: { tags: ['Customer Auth'] },
})
  // Registre central des modèles nommés → components.schemas.
  .use(models)
  // Garde session client (macro `customerAuth`) pour les routes profil/mot de passe.
  .use(customerAuthPlugin)

  // Rate-limited routes
  .use(registerRoute)
  .use(loginRoute)
  .use(passwordResetRoutes)

  // POST /customer/auth/logout (no rate limit)
  .post(
    '/logout',
    async ({ cookie }) => {
      const token = cookie[COOKIE_NAME].value;

      if (token) {
        await db.delete(customerSession).where(eq(customerSession.token, token));
      }

      cookie[COOKIE_NAME].remove();

      return { success: true };
    },
    {
      cookie: cookieSchema,
      response: { 200: successSchema },
    },
  )

  // GET /customer/auth/me (no rate limit)
  .get(
    '/me',
    async ({ cookie, status }) => {
      const token = cookie[COOKIE_NAME].value;

      if (!token) {
        return status(401, { message: 'Non authentifié' });
      }

      const [sessionData] = await db
        .select({
          session: {
            id: customerSession.id,
            expiresAt: customerSession.expiresAt,
          },
          customer: {
            id: customer.id,
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
            emailVerified: customer.emailVerified,
            marketingOptin: customer.marketingOptin,
          },
        })
        .from(customerSession)
        .innerJoin(customer, eq(customerSession.customer, customer.id))
        .where(and(eq(customerSession.token, token), gt(customerSession.expiresAt, new Date())));

      if (!sessionData) {
        cookie[COOKIE_NAME].remove();
        return status(401, { message: 'Session invalide ou expirée' });
      }

      return {
        customer: sessionData.customer,
      };
    },
    {
      cookie: cookieSchema,
      response: {
        200: 'CustomerAuth',
        401: unauthorizedResponse,
      },
    },
  )

  // POST /customer/auth/refresh - Refresh session token
  .post(
    '/refresh',
    async ({ cookie, request, status }) => {
      const token = cookie[COOKIE_NAME].value;

      if (!token) {
        return status(401, { message: 'Non authentifié' });
      }

      // Find valid session
      const [sessionData] = await db
        .select({
          id: customerSession.id,
          customerId: customerSession.customer,
        })
        .from(customerSession)
        .where(and(eq(customerSession.token, token), gt(customerSession.expiresAt, new Date())));

      if (!sessionData) {
        cookie[COOKIE_NAME].remove();
        return status(401, { message: 'Session invalide ou expirée' });
      }

      // Generate new token and extend expiry
      const newToken = generateToken();
      const newExpiresAt = getExpiresAt();
      const ipAddress =
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      await db
        .update(customerSession)
        .set({
          token: newToken,
          expiresAt: newExpiresAt,
          ipAddress,
          userAgent,
        })
        .where(eq(customerSession.id, sessionData.id));

      // Set new cookie
      cookie[COOKIE_NAME].set({
        value: newToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
      });

      return { success: true };
    },
    {
      cookie: cookieSchema,
      response: {
        200: successSchema,
        401: unauthorizedResponse,
      },
    },
  )

  // POST /customer/auth/password - Changement de mot de passe (client connecté).
  // Vérifie l'ancien mot de passe puis révoque toutes les AUTRES sessions (garde la courante).
  .post(
    '/password',
    async ({ body, cookie, currentCustomer, status }) => {
      const c = currentCustomer as SessionCustomer;

      const [row] = await db
        .select({ passwordHash: customer.passwordHash })
        .from(customer)
        .where(eq(customer.id, c.id));

      const valid = row && (await Bun.password.verify(body.currentPassword, row.passwordHash));
      if (!valid) {
        return status(401, { message: 'Mot de passe actuel incorrect' });
      }

      const passwordHash = await Bun.password.hash(body.newPassword, {
        algorithm: 'bcrypt',
        cost: 10,
      });

      await db
        .update(customer)
        .set({ passwordHash, dateUpdated: new Date() })
        .where(eq(customer.id, c.id));

      // Révoque les autres sessions (sécurité) — la session courante reste valide.
      const token = cookie[COOKIE_NAME].value;
      if (token) {
        await db
          .delete(customerSession)
          .where(and(eq(customerSession.customer, c.id), ne(customerSession.token, token)));
      }

      return { success: true };
    },
    {
      customerAuth: true,
      cookie: cookieSchema,
      body: t.Object({
        currentPassword: t.String({ minLength: 1 }),
        newPassword: t.String({ minLength: 8 }),
      }),
      response: {
        200: successSchema,
        401: unauthorizedResponse,
      },
    },
  );
