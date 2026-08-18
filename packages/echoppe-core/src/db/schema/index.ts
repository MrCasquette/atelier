// Les tables du cœur d'Échoppe, et elles seules.
//
// Ce barrel a longtemps servi deux rôles : manifeste de migration ET raccourci d'import. Le
// premier vit désormais dans `migrations.ts`, seul fichier que `drizzle.config.ts` lit. Une table
// partagée s'importe depuis SON paquet — `media` depuis `@repo/assets`, `user` depuis
// `@repo/auth`, et ainsi de suite.

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
