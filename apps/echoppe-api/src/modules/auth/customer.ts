import { faults } from '@echoppe/core';
import { Elysia, t } from 'elysia';
import { rateLimit } from 'elysia-rate-limit';
import { faultBody } from '../../lib/fault';
import { authRateLimitOptions, strictRateLimitOptions } from '../../lib/rate-limit';
import { conflictResponse, rateLimitResponse, successSchema } from '../../lib/response';
import { models } from '../../model';
import {
  authenticateCustomer,
  CUSTOMER_SESSION_DURATION_DAYS,
  changeCustomerPassword,
  destroyCustomerSession,
  readCustomerSession,
  refreshCustomerSession,
  registerCustomer,
  requestPasswordReset,
  resetPassword,
  type SessionContext,
} from './customer-service';
import {
  CUSTOMER_COOKIE_NAME,
  customerAuthPlugin,
  customerCookieSchema,
  type SessionCustomer,
} from './customer-session';

// Les réponses sont des modèles nommés (src/models/customer.ts → module `customer`), référencés par nom :
// register/`me` → `CustomerAuth` (profil complet), login → `LoginResult` (identité réduite).
// Chaque instance qui les référence fait `.use(models)`.

const SESSION_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: CUSTOMER_SESSION_DURATION_DAYS * 24 * 60 * 60,
} as const;

/** Ce que la requête dit du client, tel qu'on le garde sur la session. */
function sessionContext(request: Request): SessionContext {
  return {
    ipAddress:
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

// Rate-limited register route (strict: 5 requests / 15 min)
const registerRoute = new Elysia()
  .use(rateLimit(strictRateLimitOptions))
  .use(models)
  .post(
    '/register',
    async ({ body, cookie, request, status }) => {
      const result = await registerCustomer(body, sessionContext(request));

      if (result.outcome === 'email-taken') {
        return status(409, { message: 'Un compte existe déjà avec cet email' });
      }

      cookie[CUSTOMER_COOKIE_NAME].set({ value: result.token, ...SESSION_COOKIE });

      return { customer: result.customer };
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
      cookie: customerCookieSchema,
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
      const result = await authenticateCustomer(body, sessionContext(request));

      if (result.outcome === 'invalid-credentials') {
        return status(401, faultBody(faults.invalidCredentials()));
      }

      cookie[CUSTOMER_COOKIE_NAME].set({ value: result.token, ...SESSION_COOKIE });

      return { customer: result.customer };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 1 }),
      }),
      cookie: customerCookieSchema,
      response: {
        200: 'LoginResult',
        401: 'ErrorResponse',
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
  .use(models)
  .use(rateLimit(strictRateLimitOptions))
  .post(
    '/password/forgot',
    async ({ body }) => {
      await requestPasswordReset(body.email);

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
      const result = await resetPassword(body.token, body.newPassword);

      return result.outcome === 'invalid-token'
        ? status(400, faultBody(faults.invalidToken()))
        : { success: true };
    },
    {
      body: t.Object({
        token: t.String({ minLength: 1 }),
        newPassword: t.String({ minLength: 8 }),
      }),
      response: { 200: successSchema, 400: 'ErrorResponse', 429: rateLimitResponse },
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
      await destroyCustomerSession(cookie[CUSTOMER_COOKIE_NAME].value);
      cookie[CUSTOMER_COOKIE_NAME].remove();

      return { success: true };
    },
    {
      cookie: customerCookieSchema,
      response: { 200: successSchema },
    },
  )

  // GET /customer/auth/me (no rate limit)
  .get(
    '/me',
    async ({ cookie, status }) => {
      const token = cookie[CUSTOMER_COOKIE_NAME].value;
      if (!token) return status(401, faultBody(faults.unauthenticated()));

      const found = await readCustomerSession(token);

      if (!found) {
        cookie[CUSTOMER_COOKIE_NAME].remove();
        return status(401, faultBody(faults.invalidToken()));
      }

      return { customer: found };
    },
    {
      cookie: customerCookieSchema,
      response: {
        200: 'CustomerAuth',
        401: 'ErrorResponse',
      },
    },
  )

  // POST /customer/auth/refresh - Refresh session token
  .post(
    '/refresh',
    async ({ cookie, request, status }) => {
      const token = cookie[CUSTOMER_COOKIE_NAME].value;
      if (!token) return status(401, faultBody(faults.unauthenticated()));

      const newToken = await refreshCustomerSession(token, sessionContext(request));

      if (!newToken) {
        cookie[CUSTOMER_COOKIE_NAME].remove();
        return status(401, faultBody(faults.invalidToken()));
      }

      cookie[CUSTOMER_COOKIE_NAME].set({ value: newToken, ...SESSION_COOKIE });

      return { success: true };
    },
    {
      cookie: customerCookieSchema,
      response: {
        200: successSchema,
        401: 'ErrorResponse',
      },
    },
  )

  // POST /customer/auth/password - Changement de mot de passe (client connecté).
  // Vérifie l'ancien mot de passe puis révoque toutes les AUTRES sessions (garde la courante).
  .post(
    '/password',
    async ({ body, cookie, currentCustomer, status }) => {
      const c = currentCustomer as SessionCustomer;

      const result = await changeCustomerPassword(c.id, body, cookie[CUSTOMER_COOKIE_NAME].value);

      return result.outcome === 'wrong-password'
        ? status(401, faultBody(faults.invalidCredentials()))
        : { success: true };
    },
    {
      customerAuth: true,
      cookie: customerCookieSchema,
      body: t.Object({
        currentPassword: t.String({ minLength: 1 }),
        newPassword: t.String({ minLength: 8 }),
      }),
      response: {
        200: successSchema,
        401: 'ErrorResponse',
      },
    },
  );
