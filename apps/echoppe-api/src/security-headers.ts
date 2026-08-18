import { Elysia } from 'elysia';

/**
 * Plugin ajoutant les headers de sécurité HTTP sur toutes les réponses.
 * Équivalent Elysia de helmet.js pour Express.
 */
export const securityHeaders = new Elysia({ name: 'security-headers' }).onBeforeHandle(
  { as: 'global' },
  ({ set, request }) => {
    const url = new URL(request.url);
    const isDocsRoute = url.pathname.startsWith('/-/docs');
    const isDashboardRoute = url.pathname.startsWith('/-/admin');

    // Empêche le MIME-type sniffing
    set.headers['X-Content-Type-Options'] = 'nosniff';

    // Protection contre le clickjacking
    set.headers['X-Frame-Options'] = 'DENY';

    // Désactive le DNS prefetching (privacy)
    set.headers['X-DNS-Prefetch-Control'] = 'off';

    // Contrôle l'information envoyée dans le header Referer
    set.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';

    // Empêche le téléchargement de fichiers dans le contexte du site (IE)
    set.headers['X-Download-Options'] = 'noopen';

    // Désactive le rendu si XSS détecté (navigateurs legacy)
    set.headers['X-XSS-Protection'] = '0';

    // Empêche l'embedding de ressources cross-origin non autorisées
    set.headers['Cross-Origin-Opener-Policy'] = 'same-origin';

    // Content-Security-Policy
    // - Routes API : CSP strict (JSON only)
    // - `/-/docs` (Scalar) : permissif, l'interface a besoin d'inline
    // - `/-/admin` (dashboard) : le strict `default-src 'none'` bloquerait tout — la SPA a besoin
    //   de charger ses propres bundles. `connect-src 'self'` suffit parce que le dashboard est
    //   servi PAR l'API : il n'appelle aucune autre origine (ADR-0052).
    if (isDashboardRoute) {
      set.headers['Content-Security-Policy'] = [
        "default-src 'self'",
        "script-src 'self'",
        // Vue applique des styles dynamiques (`:style`, transitions) que le navigateur voit
        // comme de l'inline.
        "style-src 'self' 'unsafe-inline'",
        // `blob:` = prévisualisation locale d'un média avant son envoi.
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join('; ');
    } else if (isDocsRoute) {
      // CSP permissif pour Scalar (inline scripts/styles nécessaires)
      set.headers['Content-Security-Policy'] = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join('; ');
    } else {
      // CSP strict pour les routes API (JSON uniquement)
      set.headers['Content-Security-Policy'] = "default-src 'none'; frame-ancestors 'none'";
    }

    // Permissions-Policy : désactive les features navigateur non utilisées
    set.headers['Permissions-Policy'] = [
      'accelerometer=()',
      'camera=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=()',
      'usb=()',
    ].join(', ');

    // HSTS en production uniquement (force HTTPS)
    if (process.env.NODE_ENV === 'production') {
      set.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    }
  },
);
