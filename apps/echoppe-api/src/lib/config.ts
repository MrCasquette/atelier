import { join } from 'node:path';

// Upload directory - use env var in production, relative path in dev
export const UPLOAD_DIR = process.env.UPLOAD_DIR || join(import.meta.dir, '../../uploads');

// URL publique du storefront (pour les liens envoyés par email, ex. réinitialisation de mot
// de passe). Réutilise `STORE_URL` — déjà l'origine de la boutique (CORS + whitelist de
// redirection). La page correspondante (`/reset-password`) est fournie par la boutique.
export const STOREFRONT_URL = (process.env.STORE_URL || 'http://localhost:4321').replace(
  /\/+$/,
  '',
);
export const PASSWORD_RESET_PATH = '/reset-password';
