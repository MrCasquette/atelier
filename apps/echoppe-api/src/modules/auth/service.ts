import { randomBytes } from 'node:crypto';
import { and, db, eq, gt, role, session, user } from '@echoppe/core';

// Authentification de la surface d'administration, sans rien savoir du transport : ni cookie, ni
// code HTTP. Le controller pose le cookie et traduit les issues (ADR-0044).
//
// La session CLIENT vit dans `customer-session.ts` — deux publics, deux cycles de vie.

export const SESSION_DURATION_DAYS = 7;

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function getExpiresAt(): Date {
  const date = new Date();
  date.setDate(date.getDate() + SESSION_DURATION_DAYS);
  return date;
}

export type AdminLoginOutcome =
  | { outcome: 'authenticated'; token: string; user: AuthenticatedUser }
  /** E-mail inconnu OU mot de passe faux — indistinguables volontairement. */
  | { outcome: 'invalid-credentials' }
  | { outcome: 'account-disabled' };

export type AuthenticatedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

/**
 * Vérifie les identifiants et ouvre une session. Rend le jeton ; c'est au controller d'en faire un
 * cookie, parce que lui seul sait ce qu'est un cookie.
 */
export async function authenticateAdmin(
  credentials: { email: string; password: string },
  context: { ipAddress: string; userAgent: string },
): Promise<AdminLoginOutcome> {
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
    .where(eq(user.email, credentials.email.toLowerCase()));

  if (!foundUser) return { outcome: 'invalid-credentials' };
  if (!foundUser.isActive) return { outcome: 'account-disabled' };

  if (!(await Bun.password.verify(credentials.password, foundUser.passwordHash))) {
    return { outcome: 'invalid-credentials' };
  }

  const token = generateToken();

  await db.insert(session).values({
    token,
    user: foundUser.id,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    expiresAt: getExpiresAt(),
  });

  await db.update(user).set({ lastLogin: new Date() }).where(eq(user.id, foundUser.id));

  return {
    outcome: 'authenticated',
    token,
    user: {
      id: foundUser.id,
      email: foundUser.email,
      firstName: foundUser.firstName,
      lastName: foundUser.lastName,
    },
  };
}

export type AdminSessionRead =
  | { outcome: 'active'; user: SessionOwner; role: SessionOwnerRole }
  /** Aucune session valide pour ce jeton — absente, inconnue ou expirée. */
  | { outcome: 'invalid' }
  | { outcome: 'account-disabled' };

export type SessionOwner = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isOwner: boolean;
  isActive: boolean;
};

export type SessionOwnerRole = {
  id: string;
  name: string;
  scope: string;
};

/** Relit la session d'un jeton. Sert à `/auth/me` ; les gardes de route passent par `authPlugin`. */
export async function readAdminSession(token: string | undefined): Promise<AdminSessionRead> {
  if (!token) return { outcome: 'invalid' };

  const [sessionData] = await db
    .select({
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

  if (!sessionData) return { outcome: 'invalid' };
  if (!sessionData.user.isActive) return { outcome: 'account-disabled' };

  return { outcome: 'active', user: sessionData.user, role: sessionData.role };
}

/** Ferme une session. Rend l'utilisateur concerné, pour que le controller puisse le tracer. */
export async function destroyAdminSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;

  const [sessionData] = await db
    .select({ userId: session.user })
    .from(session)
    .where(eq(session.token, token));

  await db.delete(session).where(eq(session.token, token));

  return sessionData?.userId ?? null;
}
