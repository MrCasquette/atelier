// @repo/identity — l'identité d'un site et de l'entité légale derrière lui (ADR-0040).
//
// Des définitions de tables, rien d'autre : pas de modèle de validation ici, l'exigence appartient
// au produit. Voir README.md.

/** Ce que ce paquet possède, nommable dans une faute (ADR-0050). Un produit compose les siennes. */
export type IdentityResource = 'site' | 'legal_entity' | 'country';
export { country, legalEntity, site } from './schema';
