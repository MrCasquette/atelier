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

// Authentification de la surface CLIENT, sans rien savoir du transport. Pendant de `service.ts`,
// qui sert l'administration : deux publics, deux cycles de vie, deux jeux d'identifiants.

export const CUSTOMER_SESSION_DURATION_DAYS = 7;

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 heure
const PASSWORD_COST = { algorithm: 'bcrypt', cost: 10 } as const;

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

// URL publique du storefront, pour les liens envoyés par e-mail (réinitialisation de mot de passe).
// Réutilise `STORE_URL` — déjà l'origine de la boutique (CORS + liste blanche de redirection) : en
// faire une variable d'environnement à part créerait deux sources de vérité pour la même adresse.
const STOREFRONT_URL = (process.env.STORE_URL || 'http://localhost:4321').replace(/\/+$/, '');
// Le storefront est remplaçable, donc ce chemin POURRAIT varier par déploiement — mais personne ne
// l'a demandé, et le jour venu `process.env.PASSWORD_RESET_PATH ?? …` est un changement d'une ligne.
const PASSWORD_RESET_PATH = '/reset-password';

/** Ce que le client apporte avec sa requête, et qu'on garde sur la session pour la tracer. */
export type SessionContext = {
  ipAddress: string;
  userAgent: string;
};

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function getExpiresAt(): Date {
  const date = new Date();
  date.setDate(date.getDate() + CUSTOMER_SESSION_DURATION_DAYS);
  return date;
}

async function openSession(customerId: string, context: SessionContext): Promise<string> {
  const token = generateToken();

  await db.insert(customerSession).values({
    token,
    customer: customerId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    expiresAt: getExpiresAt(),
  });

  await db.update(customer).set({ lastLogin: new Date() }).where(eq(customer.id, customerId));

  return token;
}

// ============================================
// INSCRIPTION ET CONNEXION
// ============================================

export type RegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  marketingOptin?: boolean;
};

export type RegisterOutcome =
  | {
      outcome: 'registered';
      token: string;
      customer: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        emailVerified: boolean;
        marketingOptin: boolean;
      };
    }
  | { outcome: 'email-taken' };

export async function registerCustomer(
  input: RegisterInput,
  context: SessionContext,
): Promise<RegisterOutcome> {
  const email = input.email.toLowerCase();

  const [existing] = await db
    .select({ id: customer.id })
    .from(customer)
    .where(eq(customer.email, email));
  if (existing) return { outcome: 'email-taken' };

  const passwordHash = await Bun.password.hash(input.password, PASSWORD_COST);

  const [created] = await db
    .insert(customer)
    .values({
      email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      marketingOptin: input.marketingOptin ?? false,
    })
    .returning();

  const token = await openSession(created.id, context);

  await sendWelcomeEmail({ customerEmail: created.email, customerName: created.firstName });

  return {
    outcome: 'registered',
    token,
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
}

export type CustomerLoginOutcome =
  | {
      outcome: 'authenticated';
      token: string;
      customer: { id: string; email: string; firstName: string; lastName: string };
    }
  /** E-mail inconnu OU mot de passe faux — indistinguables volontairement. */
  | { outcome: 'invalid-credentials' };

export async function authenticateCustomer(
  credentials: { email: string; password: string },
  context: SessionContext,
): Promise<CustomerLoginOutcome> {
  const [found] = await db
    .select({
      id: customer.id,
      email: customer.email,
      passwordHash: customer.passwordHash,
      firstName: customer.firstName,
      lastName: customer.lastName,
    })
    .from(customer)
    .where(eq(customer.email, credentials.email.toLowerCase()));

  if (!found) return { outcome: 'invalid-credentials' };
  if (!(await Bun.password.verify(credentials.password, found.passwordHash))) {
    return { outcome: 'invalid-credentials' };
  }

  const token = await openSession(found.id, context);

  return {
    outcome: 'authenticated',
    token,
    customer: {
      id: found.id,
      email: found.email,
      firstName: found.firstName,
      lastName: found.lastName,
    },
  };
}

// ============================================
// SESSION COURANTE
// ============================================

export async function readCustomerSession(token: string | undefined) {
  if (!token) return null;

  const [sessionData] = await db
    .select({
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

  return sessionData?.customer ?? null;
}

export async function destroyCustomerSession(token: string | undefined): Promise<void> {
  if (!token) return;

  await db.delete(customerSession).where(eq(customerSession.token, token));
}

/**
 * Fait tourner le jeton d'une session valide et repousse son échéance. Rend le nouveau jeton, ou
 * `null` si la session ne vaut plus rien.
 */
export async function refreshCustomerSession(
  token: string | undefined,
  context: SessionContext,
): Promise<string | null> {
  if (!token) return null;

  const [sessionData] = await db
    .select({ id: customerSession.id })
    .from(customerSession)
    .where(and(eq(customerSession.token, token), gt(customerSession.expiresAt, new Date())));

  if (!sessionData) return null;

  const newToken = generateToken();

  await db
    .update(customerSession)
    .set({
      token: newToken,
      expiresAt: getExpiresAt(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    })
    .where(eq(customerSession.id, sessionData.id));

  return newToken;
}

// ============================================
// MOT DE PASSE
// ============================================

/**
 * Crée un jeton de réinitialisation et envoie le lien. Ne dit JAMAIS si l'e-mail existe — c'est
 * l'appelant qui répond invariablement 200, et cette fonction ne lui donne pas de quoi trahir.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const [found] = await db
    .select({ id: customer.id, email: customer.email })
    .from(customer)
    .where(eq(customer.email, email.toLowerCase()));

  if (!found) return;

  // Le jeton brut part par e-mail, seule son empreinte est stockée.
  const rawToken = generateToken();
  await db.insert(passwordResetToken).values({
    customer: found.id,
    tokenHash: sha256(rawToken),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });

  const resetUrl = `${STOREFRONT_URL}${PASSWORD_RESET_PATH}?token=${rawToken}`;
  await sendResetPasswordEmail({ email: found.email, resetUrl, expiresIn: '1 heure' });
}

export type ResetPasswordOutcome =
  | { outcome: 'reset' }
  /** Jeton inconnu, déjà consommé ou périmé — les trois ne se distinguent pas côté appelant. */
  | { outcome: 'invalid-token' };

export async function resetPassword(
  rawToken: string,
  newPassword: string,
): Promise<ResetPasswordOutcome> {
  const [tokenRow] = await db
    .select({
      id: passwordResetToken.id,
      customer: passwordResetToken.customer,
      expiresAt: passwordResetToken.expiresAt,
      usedAt: passwordResetToken.usedAt,
    })
    .from(passwordResetToken)
    .where(eq(passwordResetToken.tokenHash, sha256(rawToken)));

  if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt < new Date()) {
    return { outcome: 'invalid-token' };
  }

  const passwordHash = await Bun.password.hash(newPassword, PASSWORD_COST);

  await db
    .update(customer)
    .set({ passwordHash, dateUpdated: new Date() })
    .where(eq(customer.id, tokenRow.customer));

  // Jeton consommé + révocation de TOUTES les sessions : qui a pu demander la réinitialisation a
  // pu ouvrir une session.
  await db
    .update(passwordResetToken)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetToken.id, tokenRow.id));
  await db.delete(customerSession).where(eq(customerSession.customer, tokenRow.customer));

  return { outcome: 'reset' };
}

export type ChangePasswordOutcome = { outcome: 'changed' } | { outcome: 'wrong-password' };

/**
 * Change le mot de passe d'un client connecté. Révoque les AUTRES sessions et garde la courante :
 * l'utilisateur ne se déconnecte pas lui-même en sécurisant son compte.
 */
export async function changeCustomerPassword(
  customerId: string,
  passwords: { currentPassword: string; newPassword: string },
  keepToken: string | undefined,
): Promise<ChangePasswordOutcome> {
  const [row] = await db
    .select({ passwordHash: customer.passwordHash })
    .from(customer)
    .where(eq(customer.id, customerId));

  if (!row || !(await Bun.password.verify(passwords.currentPassword, row.passwordHash))) {
    return { outcome: 'wrong-password' };
  }

  const passwordHash = await Bun.password.hash(passwords.newPassword, PASSWORD_COST);

  await db
    .update(customer)
    .set({ passwordHash, dateUpdated: new Date() })
    .where(eq(customer.id, customerId));

  if (keepToken) {
    await db
      .delete(customerSession)
      .where(and(eq(customerSession.customer, customerId), ne(customerSession.token, keepToken)));
  }

  return { outcome: 'changed' };
}
