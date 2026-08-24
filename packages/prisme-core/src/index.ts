// @prisme/core — le cœur du produit Prisme : il possède la base et ses migrations (ADR-0025).
//
// Il ne possède, aujourd'hui, RIEN D'AUTRE — et ce n'est pas un manque. Prisme ne déclare aucune
// table en propre : ses tables sont celles des paquets partagés, qu'il embarque dans SES migrations
// (cf. `src/db/schema/migrations.ts`). Un cœur peut donc être quasi vide et rester nécessaire :
// c'est la propriété des migrations qui le justifie, pas un schéma.
//
// Ce barrel n'exportera jamais une capacité partagée. `db` s'importe depuis `@repo/db`, `media`
// depuis `@repo/assets`, `user` depuis `@repo/auth` — c'est gardé par `core-passthrough`, pas
// seulement écrit.

import { fileURLToPath } from 'node:url';

/**
 * Le dossier des migrations SQL versionnées de Prisme.
 *
 * Exposé par le cœur plutôt que reconstruit par l'API : c'est le cœur qui les possède, donc c'est
 * à lui de dire où elles sont. Un appelant qui remonte trois `..` depuis ses propres sources se
 * casse au premier déplacement de fichier — et se casse en silence, puisqu'un dossier de migrations
 * absent ne fait qu'appliquer zéro migration.
 *
 * En image, `MIGRATIONS_DIR` prime : le binaire compilé n'a plus d'arborescence de sources.
 */
export const MIGRATIONS_DIR = fileURLToPath(new URL('../drizzle', import.meta.url));
