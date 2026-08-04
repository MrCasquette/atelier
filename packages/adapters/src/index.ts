// @repo/adapters — la mécanique commune aux familles d'adapters (paiement, livraison,
// communication), sans aucun provider ni aucune table.
//
// Ce paquet ne dépend de rien : ni base, ni schéma, ni drizzle. C'est du code pur. Il porte ce qui
// se répétait à l'identique dans les trois familles — le registre déclaratif et l'abstraction
// d'injection des credentials.

export type { CredentialStore } from './credential-store';
export { type AdapterRegistry, createAdapterRegistry } from './registry';
