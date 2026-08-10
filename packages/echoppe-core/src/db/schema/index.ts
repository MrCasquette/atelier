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
} from '@repo/auth';
// Tables de communication : @repo/communication (ADR-0025) — le cœur les inclut dans SON
// barrel, donc dans ses migrations.
export {
  communicationLog,
  communicationProviderConfig,
  communicationProviderEnum,
} from '@repo/communication';
// Identité et référentiel : @repo/identity (ADR-0040). Le cœur les inclut dans SON barrel,
// donc dans ses migrations.
export { country, legalEntity, site } from '@repo/identity';
// Navigation : @repo/menus (ADR-0033). Le cœur l'inclut dans SON barrel, donc dans ses migrations.
export { type MenuItem, type MenuLink, menu } from '@repo/menus';
// Pages, sections et registre de définitions : @repo/pages (ADR-0033).
export { contentDefinition, contentStatusEnum, page, section } from '@repo/pages';
export * from './cart';
export * from './catalog';
export * from './customer';
export * from './document';
export * from './engagement';
export * from './orders';
export * from './payment';
export * from './settings';
export * from './shipping';
export * from './stock';
export * from './tax';
