import { faults } from '@echoppe/core';
import { getSessionFromToken } from '@repo/auth';
import { Elysia, t } from 'elysia';
import { faultBody } from '../../lib/fault';
import { cookieValue } from '../../lib/cookie';

// Ce qui reste du transport : le nom du cookie, son schéma, et la macro qui refuse en 401. La
// lecture de session vit dans `@repo/auth` (ADR-0044).

export const COOKIE_NAME = 'echoppe_admin_session';

// Schema cookie pour le typage
export const cookieSchema = t.Cookie({
  [COOKIE_NAME]: t.Optional(t.String()),
});

// Plugin singleton avec macro pour l'authentification
// Usage:
//   .use(authPlugin)
//   .get('/public', () => 'public')  // Pas de macro = public
//   .post('/protected', ({ currentUser }) => currentUser, { auth: true })  // auth: true = protégé
export const authPlugin = new Elysia({ name: 'auth' }).macro({
  auth: {
    async resolve({ cookie, request, status }) {
      const token = cookieValue(cookie, COOKIE_NAME);
      const sessionData = await getSessionFromToken(token);

      if (!sessionData.isAuthenticated) {
        return status(401, faultBody(faults.unauthenticated()));
      }

      // Verify User-Agent matches (strict check for session hijacking)
      const currentUserAgent = request.headers.get('user-agent') ?? 'unknown';
      if (sessionData.storedUserAgent && sessionData.storedUserAgent !== currentUserAgent) {
        console.warn('[Security] User-Agent mismatch for admin session', {
          userId: sessionData.currentUser?.id,
          stored: sessionData.storedUserAgent?.substring(0, 50),
          current: currentUserAgent.substring(0, 50),
        });
        // Le jeton porté ne vaut plus : l'empreinte du client a changé. Indistinct d'un jeton
        // expiré pour l'appelant, et c'est délibéré.
        return status(401, faultBody(faults.invalidToken()));
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
