import { createEchoppeClient } from '@echoppe/client';

// URL de l'API Échoppe. PUBLIC_ car l'URL des images est aussi utilisée côté navigateur.
export const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:7532';

// Client typé, généré depuis l'OpenAPI de l'API. Les appels se font côté serveur (SSR).
export const api = createEchoppeClient({ baseUrl: API_URL });

/** URL publique d'un média servi par l'API (`/assets/:id`). */
export function mediaUrl(id: string | null | undefined): string | undefined {
  return id ? `${API_URL}/assets/${id}` : undefined;
}

/** Formate un prix (chaîne ou nombre) en euros. */
export function formatPrice(price: string | number | null | undefined): string {
  if (price === null || price === undefined) return '';
  const value = typeof price === 'string' ? Number(price) : price;
  if (Number.isNaN(value)) return '';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}
