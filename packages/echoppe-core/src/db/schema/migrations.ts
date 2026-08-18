// Manifeste des migrations — SEUL consommateur : `drizzle.config.ts`.
//
// Drizzle ne migre que ce qu'il voit depuis un point d'entrée unique : ce fichier doit donc
// énumérer les tables partagées que le cœur embarque dans SES migrations (ADR-0025). C'est la
// seule énumération légitime, et elle est ici plutôt que dans `index.ts` pour une raison précise :
// ce chemin n'est pas déclaré dans les `exports` du paquet, donc rien ne peut l'importer. Le
// raccourci qu'on cherchait à supprimer devient inatteignable, au lieu d'être seulement interdit.

// Les tables du cœur.
export * from './index';

// Les tables partagées, embarquées dans les migrations du cœur.
// Sonde d'extraction (ADR-0025) : les tables média vivent dans @repo/assets et sont réexportées
// ici. Le cœur reste propriétaire des migrations — drizzle.config.ts ne lit que ce barrel.
export { folder, media } from '@repo/assets';
// Authentification et droits : @repo/auth (ADR-0033). Le cœur les inclut dans SON barrel, donc
// dans ses migrations.
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
// Tables de communication : @repo/communication (ADR-0025) — le cœur les inclut dans SON
// barrel, donc dans ses migrations.
export {
  communicationLog,
  communicationProviderConfig,
  communicationProviderEnum,
} from '@repo/communication';
// Journal des entités déclarées : @repo/entities (ADR-0027, ADR-0028). Seul le JOURNAL entre dans
// les migrations — les tables d'entités, elles, sont dérivées au push et n'y sont jamais.
export { entityDefinition } from '@repo/entities';
// Identité et référentiel : @repo/identity (ADR-0040). Le cœur les inclut dans SON barrel,
// donc dans ses migrations.
export { country, legalEntity, site } from '@repo/identity';
// Navigation : @repo/menus (ADR-0033). Le cœur l'inclut dans SON barrel, donc dans ses migrations.
export { type MenuItem, type MenuLink, menu } from '@repo/menus';
// Pages, sections et registre de définitions : @repo/pages (ADR-0033).
export { contentDefinition, contentStatusEnum, page, section } from '@repo/pages';
