import { and, db, eq, gt, role, session, user } from '@echoppe/core';
import { Elysia, t } from 'elysia';

export const COOKIE_NAME = 'echoppe_admin_session';

// Schema cookie pour le typage
export const cookieSchema = t.Cookie({
  [COOKIE_NAME]: t.Optional(t.String()),
});

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
  name: string;
  scope: 'admin' | 'store';
};

export type AuthContext = {
  currentUser: SessionUser | null;
  currentRole: SessionRole | null;
  isAuthenticated: boolean;
};

type SessionWithMeta = AuthContext & {
  storedUserAgent: string | null;
  storedIpAddress: string | null;
};

// Fonction réutilisable pour vérifier la session
export async function getSessionFromToken(token: string | undefined): Promise<SessionWithMeta> {
  if (!token) {
    return {
      currentUser: null,
      currentRole: null,
      isAuthenticated: false,
      storedUserAgent: null,
      storedIpAddress: null,
    };
  }

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
      session: {
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
      },
    })
    .from(session)
    .innerJoin(user, eq(session.user, user.id))
    .innerJoin(role, eq(user.role, role.id))
    .where(and(eq(session.token, token), gt(session.expiresAt, new Date())));

  if (!sessionData?.user.isActive) {
    return {
      currentUser: null,
      currentRole: null,
      isAuthenticated: false,
      storedUserAgent: null,
      storedIpAddress: null,
    };
  }

  return {
    currentUser: sessionData.user as SessionUser,
    currentRole: sessionData.role as SessionRole,
    isAuthenticated: true,
    storedUserAgent: sessionData.session.userAgent,
    storedIpAddress: sessionData.session.ipAddress,
  };
}

// Plugin singleton avec macro pour l'authentification
// Usage:
//   .use(authPlugin)
//   .get('/public', () => 'public')  // Pas de macro = public
//   .post('/protected', ({ currentUser }) => currentUser, { auth: true })  // auth: true = protégé
export const authPlugin = new Elysia({ name: 'auth' }).macro({
  auth: {
    async resolve({ cookie, request, status }) {
      const token = (cookie as Record<string, { value?: string }>)[COOKIE_NAME]?.value;
      const sessionData = await getSessionFromToken(token);

      if (!sessionData.isAuthenticated) {
        return status(401, { message: 'Non authentifié' });
      }

      // Verify User-Agent matches (strict check for session hijacking)
      const currentUserAgent = request.headers.get('user-agent') ?? 'unknown';
      if (sessionData.storedUserAgent && sessionData.storedUserAgent !== currentUserAgent) {
        console.warn('[Security] User-Agent mismatch for admin session', {
          userId: sessionData.currentUser?.id,
          stored: sessionData.storedUserAgent?.substring(0, 50),
          current: currentUserAgent.substring(0, 50),
        });
        return status(401, { message: 'Session invalide' });
      }

      // Log IP changes (warning only, don't block)
      const currentIp =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown';
      if (sessionData.storedIpAddress && sessionData.storedIpAddress !== currentIp) {
        console.info('[Security] IP change detected for admin session', {
          userId: sessionData.currentUser?.id,
          stored: sessionData.storedIpAddress,
          current: currentIp,
        });
      }

      return {
        currentUser: sessionData.currentUser,
        currentRole: sessionData.currentRole,
      };
    },
  },
});
