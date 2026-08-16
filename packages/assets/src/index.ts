// @repo/assets — les tables du média, sans migration ni service.
//
// Aucune dépendance sortante : c'est la sonde d'extraction d'ADR-0025. Voir README.md.

/** Ce que ce paquet possède, nommable dans une faute (ADR-0050). Un produit compose les siennes. */
export type AssetsResource = 'media' | 'folder' | 'file';

export { folder, media } from './schema';
