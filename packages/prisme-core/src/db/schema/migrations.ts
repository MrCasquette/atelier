// Manifeste des migrations de Prisme — SEUL consommateur : `drizzle.config.ts`.
//
// Miroir exact de celui d'Échoppe, et pour la même raison : un paquet partagé ne porte jamais de
// migrations, c'est le cœur qui les embarque (ADR-0025). Drizzle ne migre que ce qu'il voit depuis
// un point d'entrée unique, d'où cette énumération — la seule légitime. Elle vit ici plutôt que
// dans un barrel exporté parce que ce chemin n'est PAS déclaré dans les `exports` du paquet : rien
// ne peut l'importer, donc le raccourci qu'on interdit devient inatteignable.
//
// Ce que ce fichier dit d'intéressant, c'est ce qu'il NE dit PAS. Prisme ne possède aucune table en
// propre : tout ce qu'il migre appartient aux paquets partagés. Sa liste est celle d'Échoppe MOINS
// le commerce — c'est la règle de placement d'AGENTS.md rendue exécutable, et c'est ce qui prouve
// que le contenu était bien partagé et non emprunté à un produit.

// Médiathèque : @repo/assets.
export { folder, media } from '@repo/assets';
// Authentification et droits : @repo/auth (ADR-0037, ADR-0038).
export {
  apiKey,
  auditLog,
  permission,
  role,
  roleScopeEnum,
  session,
  user,
  userPasswordToken,
} from '@repo/auth';
// Journal des entités déclarées : @repo/entities (ADR-0027, ADR-0028). Seul le JOURNAL entre dans
// les migrations — les tables d'entités sont dérivées au push et n'y sont jamais.
export { entityDefinition } from '@repo/entities';
// Identité et référentiel : @repo/identity (ADR-0034, ADR-0040).
export { country, legalEntity, site } from '@repo/identity';
// Navigation : @repo/menus (ADR-0032).
export { type MenuItem, type MenuLink, menu } from '@repo/menus';
// Pages, sections et registre de définitions : @repo/pages (ADR-0026).
export { contentDefinition, contentStatusEnum, page, section } from '@repo/pages';

// PAS ENCORE EMBARQUÉ, et c'est délibéré :
//
// - `@repo/communication` — Prisme enverra des courriels (invitation, réinitialisation), mais rien
//   ne le prouve tant que la surface d'authentification n'existe pas. Une migration s'ajoute ;
//   une table créée sans usage se traîne.
