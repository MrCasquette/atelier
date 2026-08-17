import createOpenApiClient, { type ClientOptions } from 'openapi-fetch';
import { createResources } from './facade.js';
import type { paths } from './openapi.js';

export interface EchoppeClientOptions {
  /** URL de base de l'API Échoppe, ex. `https://api.maboutique.fr`. */
  baseUrl: string;
  /** En-têtes envoyés par défaut sur chaque requête (contexte SSR, etc.). */
  headers?: Record<string, string>;
  /**
   * Implémentation de `fetch` à utiliser (SSR, tests). Défaut : `fetch` global.
   */
  fetch?: ClientOptions['fetch'];
}

/**
 * Crée un client typé pour l'API Échoppe.
 *
 * L'authentification repose sur des cookies de session HTTP-only : le client
 * force donc `credentials: 'include'` pour que les routes protégées fonctionnent.
 *
 * Expose une **façade ressource** namespacée (`echoppe.products.list()`,
 * `echoppe.cart.addItem()`, `echoppe.auth.login()`…) — voir `src/facade.ts` (généré). Le
 * client brut openapi-fetch reste accessible via `echoppe.raw` (échappatoire pour tout cas
 * non couvert par la façade).
 */
export function createEchoppeClient(options: EchoppeClientOptions) {
  const client = createOpenApiClient<paths>({
    baseUrl: options.baseUrl.replace(/\/+$/, ''),
    credentials: 'include',
    headers: options.headers,
    fetch: options.fetch,
  });

  return { ...createResources(client), raw: client };
}

export type EchoppeClient = ReturnType<typeof createEchoppeClient>;
