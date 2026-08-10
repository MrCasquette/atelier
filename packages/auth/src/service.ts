import { randomBytes } from 'node:crypto';
import { and, db, eq, gt } from '@repo/db';
import { role, session, user } from './schema';

// Authentification de la surface d'ADMINISTRATION, sans rien savoir du transport : ni cookie, ni
// code HTTP. Le produit pose le cookie, traduit les issues et porte la macro de garde (ADR-0044).
//
// La session CLIENT n'est pas ici : elle est propre à Échoppe, un CMS n'a pas de clients.

export const SESSION_DURATION_DAYS = 7;

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function getExpiresAt(): Date {
  const date = new Date();
  date.setDate(date.getDate() + SESSION_DURATION_DAYS);
  return date;
}

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isOwner: boolean;
  isActive: boolean;
};

export type SessionRole = {
  id: string;
  // Clé immuable des rôles système (`owner`, `admin`, `customer`, `public`), `null` pour un rôle
  // créé depuis l'administration. C'est elle qui porte le RANG, jamais `name` qui est de
  // l'affichage — cf. ADR-0038.
  key: string | null;
  name: string;
  scope: 'admin' | 'public';
};

export type AuthContext = {
  currentUser: SessionUser | null;
  currentRole: SessionRole | null;
  isAuthenticated: boolean;
};

export type SessionWithMeta = AuthContext & {
  storedUserAgent: string | null;
  storedIpAddress: string | null;
};

const NO_SESSION: SessionWithMeta = {
  currentUser: null,
  currentRole: null,
  isAuthenticated: false,
  storedUserAgent: null,
  storedIpAddress: null,
};

type SessionRow = {
  user: SessionUser;
  role: SessionRole;
  storedUserAgent: string | null;
  storedIpAddress: string | null;
};

/**
 * La lecture de session, en un seul endroit. `isActive` n'est PAS filtré ici : un compte désactivé
 * doit se distinguer d'un jeton inconnu pour qui veut le dire à l'appelant (`readAdminSession`),
 * pendant que la garde de route, elle, ne fait aucune différence.
 */
async function findSession(token: string): Promise<SessionRow | null> {
  const [row] = await db
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
        key: role.key,
        name: role.name,
        scope: role.scope,
      },
      session: {
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
      },
    })
    .from(session)
    .innerJoin(user, eq(session.user, user.id))
    .innerJoin(role, eq(user.role, role.id))
    .where(and(eq(session.token, token), gt(session.expiresAt, new Date())));

  if (!row) return null;

  return {
    user: row.user,
    role: row.role,
    storedUserAgent: row.session.userAgent,
    storedIpAddress: row.session.ipAddress,
  };
}

/**
 * Session d'un jeton, avec ce que la requête d'origine disait du client. Sert à la garde de route :
 * un compte désactivé y est simplement non authentifié.
 */
export async function getSessionFromToken(token: string | undefined): Promise<SessionWithMeta> {
  if (!token) return NO_SESSION;

  const found = await findSession(token);
  if (!found?.user.isActive) return NO_SESSION;

  return {
    currentUser: found.user,
    currentRole: found.role,
    isAuthenticated: true,
    storedUserAgent: found.storedUserAgent,
    storedIpAddress: found.storedIpAddress,
  };
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type AdminLoginOutcome =
  | { outcome: 'authenticated'; token: string; user: AuthenticatedUser }
  /** E-mail inconnu OU mot de passe faux — indistinguables volontairement. */
  | { outcome: 'invalid-credentials' }
  | { outcome: 'account-disabled' };

/**
 * Vérifie les identifiants et ouvre une session. Rend le jeton ; c'est au produit d'en faire un
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

export type SessionOwnerRole = {
  id: string;
  name: string;
  scope: string;
};

export type AdminSessionRead =
  | { outcome: 'active'; user: SessionUser; role: SessionOwnerRole }
  /** Aucune session valide pour ce jeton — absente, inconnue ou expirée. */
  | { outcome: 'invalid' }
  | { outcome: 'account-disabled' };

/**
 * Relit la session d'un jeton pour la RENDRE à l'appelant. Distingue le compte désactivé du jeton
 * mort, là où la garde de route confond les deux — cf. `getSessionFromToken`.
 */
export async function readAdminSession(token: string | undefined): Promise<AdminSessionRead> {
  if (!token) return { outcome: 'invalid' };

  const found = await findSession(token);

  if (!found) return { outcome: 'invalid' };
  if (!found.user.isActive) return { outcome: 'account-disabled' };

  // Projection explicite : la `key` du rôle porte le rang et n'a rien à faire dans une lecture
  // destinée à être rendue.
  return {
    outcome: 'active',
    user: found.user,
    role: { id: found.role.id, name: found.role.name, scope: found.role.scope },
  };
}

/** Ferme une session. Rend l'utilisateur concerné, pour que le produit puisse le tracer. */
export async function destroyAdminSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;

  const [sessionData] = await db
    .select({ userId: session.user })
    .from(session)
    .where(eq(session.token, token));

  await db.delete(session).where(eq(session.token, token));

  return sessionData?.userId ?? null;
}
