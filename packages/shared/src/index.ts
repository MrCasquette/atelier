// @repo/shared — ce qui n'a aucune dépendance : utilitaires purs, et le contrat de faute.
//
// Rien qui touche à la base, au HTTP ou à un schéma : ce paquet est en dessous de tout, ce qui est
// la raison pour laquelle le contrat de faute y vit — tout paquet qui refuse quelque chose doit
// pouvoir le dire. Voir README.md.

export * from './fault.js';
export * from './utils/index.js';
