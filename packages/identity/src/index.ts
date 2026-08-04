// @repo/identity — l'identité d'un site et de l'entité légale derrière lui (ADR-0040).
//
// Ce paquet ne livre que des DÉFINITIONS de tables ; chaque cœur les inclut dans son barrel et donc
// dans ses migrations (ADR-0025). Il ne contient volontairement aucun modèle de validation : la
// liste de champs TypeBox vit dans l'app, où conventions.md la situe, et n'a qu'un seul
// consommateur tant que prisme-api n'existe pas. On l'extraira sur duplication réelle.
export { country, legalEntity, site } from './schema';
