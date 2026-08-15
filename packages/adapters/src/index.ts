// @repo/adapters — la mécanique commune aux familles d'adapters.
//
// Aucun provider concret, aucune table, aucune dépendance : du code pur. Voir README.md.

export type { CredentialStore } from './credential-store';
export { type AdapterRegistry, createAdapterRegistry } from './registry';
