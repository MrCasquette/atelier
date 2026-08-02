// Sonde d'extraction (ADR-0025) : les tables média vivent dans @repo/assets et sont réexportées
// ici. Le cœur reste propriétaire des migrations — drizzle.config.ts ne lit que ce barrel.
export { folder, media } from '@repo/assets';
export * from './admin';
export * from './auth';
export * from './cart';
export * from './catalog';
export * from './communication';
export * from './content';
export * from './customer';
export * from './document';
export * from './engagement';
export * from './orders';
export * from './payment';
export * from './referential';
export * from './settings';
export * from './shipping';
export * from './stock';
export * from './tax';
