import { t } from 'elysia';

// Schémas d'entité du domaine identité — SOURCE UNIQUE (ADR-0040).
//
// `site` et `legalEntity` sont deux tables permissives partagées entre les produits ; c'est ICI que
// s'exprime l'exigence propre à Échoppe. La liste de champs est écrite UNE FOIS, les profils
// d'exigence en dérivent par t.Partial / t.Required / t.Composite.
//
// Elle vit dans l'app plutôt que dans @repo/identity pour deux raisons : conventions.md situe la
// SSOT du contrat dans models/*.ts, et TypeBox n'est présent qu'en dépendance transitive — en faire
// une dépendance directe du paquet inviterait un décalage de version avec Elysia. On l'extraira sur
// duplication réelle, quand prisme-api existera.

export const siteSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique de la fiche site.' }),
  name: t.String({ description: 'Nom du site.' }),
  logo: t.Nullable(t.String({ format: 'uuid', description: 'UUID du média du logo.' })),
  url: t.Nullable(t.String({ description: 'URL publique du site.' })),
  description: t.Nullable(t.String({ description: 'Description courte du site.' })),
  publicEmail: t.Nullable(t.String({ description: 'E-mail de contact public.' })),
  publicPhone: t.Nullable(t.String({ description: 'Téléphone de contact public.' })),
  publisherName: t.Nullable(t.String({ description: 'Nom du directeur de la publication.' })),
  hostName: t.Nullable(t.String({ description: "Nom de l'hébergeur du site." })),
  hostAddress: t.Nullable(t.String({ description: "Adresse de l'hébergeur." })),
  hostPhone: t.Nullable(t.String({ description: "Téléphone de l'hébergeur." })),
});

export const legalEntitySchema = t.Object({
  id: t.String({ format: 'uuid', description: "Identifiant unique de l'entité légale." }),
  name: t.Nullable(t.String({ description: 'Raison sociale, ou prénom et nom.' })),
  legalForm: t.Nullable(t.String({ description: 'Forme juridique (ex. « SASU », « AE »).' })),
  siren: t.Nullable(t.String({ description: 'Numéro SIREN (9 chiffres).' })),
  siret: t.Nullable(t.String({ description: 'Numéro SIRET (14 chiffres).' })),
  tvaIntra: t.Nullable(t.String({ description: 'Numéro de TVA intracommunautaire.' })),
  rcsCity: t.Nullable(t.String({ description: "Ville d'immatriculation au RCS." })),
  shareCapital: t.Nullable(t.String({ description: 'Capital social, décimal en chaîne.' })),
  street: t.Nullable(t.String({ description: 'Rue et numéro du siège.' })),
  street2: t.Nullable(t.String({ description: "Complément d'adresse." })),
  postalCode: t.Nullable(t.String({ description: 'Code postal.' })),
  city: t.Nullable(t.String({ description: 'Ville.' })),
  country: t.Nullable(t.String({ format: 'uuid', description: 'UUID du pays du siège.' })),
});

// Réglages de facturation — propres à Échoppe (ADR-0034), exposés sur la même surface tant qu'ils
// partagent le même écran.
export const storeSettingsSchema = t.Object({
  documentPrefix: t.String({ description: 'Préfixe des numéros de documents (ex. « REC »).' }),
  invoicePrefix: t.String({ description: 'Préfixe des numéros de factures (ex. « FA »).' }),
  taxExempt: t.Boolean({ description: 'Franchise de TVA (art. 293 B).' }),
});

// `legal` vaut null quand aucune entité légale n'est renseignée — l'absence de ligne EST le signal
// (ADR-0040), et le contrat le reflète.
export const identitySchema = t.Object({
  site: t.Nullable(siteSchema),
  legal: t.Nullable(legalEntitySchema),
  settings: storeSettingsSchema,
});

export const countrySchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique du pays.' }),
  name: t.String({ description: 'Nom du pays.' }),
  code: t.String({ description: 'Code ISO du pays (ex. « FR »).' }),
});

// ============================================
// PROFILS D'EXIGENCE
// ============================================

const siteInput = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  logo: t.Optional(t.Nullable(t.String({ format: 'uuid' }))),
  url: t.Optional(t.Nullable(t.String({ maxLength: 255 }))),
  description: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
  publicEmail: t.Optional(t.Nullable(t.String({ format: 'email', maxLength: 255 }))),
  publicPhone: t.Optional(t.Nullable(t.String({ maxLength: 20 }))),
  publisherName: t.Optional(t.Nullable(t.String({ maxLength: 255 }))),
  hostName: t.Optional(t.Nullable(t.String({ maxLength: 255 }))),
  hostAddress: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
  hostPhone: t.Optional(t.Nullable(t.String({ maxLength: 20 }))),
});

// La liste complète, écrite une fois. Prisme en dérivera `t.Partial(legalEntityFields)`.
const legalEntityFields = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  legalForm: t.String({ maxLength: 50 }),
  siren: t.String({ maxLength: 9 }),
  siret: t.String({ maxLength: 14 }),
  tvaIntra: t.String({ maxLength: 20 }),
  rcsCity: t.String({ maxLength: 100 }),
  shareCapital: t.String(),
  street: t.String({ minLength: 1, maxLength: 255 }),
  street2: t.String({ maxLength: 255 }),
  postalCode: t.String({ minLength: 1, maxLength: 10 }),
  city: t.String({ minLength: 1, maxLength: 100 }),
  country: t.String({ format: 'uuid' }),
});

// Ce qu'une facture impose (ADR-0040). Échoppe refuse d'enregistrer une entité légale partielle ;
// `generateInvoice` reste le garde-fou pour le cas « aucune entité du tout ».
const SELLER_REQUIRED = ['name', 'street', 'postalCode', 'city'] as const;

export const legalEntityInput = t.Composite([
  t.Partial(legalEntityFields),
  t.Required(t.Pick(legalEntityFields, SELLER_REQUIRED)),
]);

export const identityBody = t.Object({
  site: siteInput,
  // `null` supprime l'entité légale ; absente, elle est laissée inchangée.
  legal: t.Optional(t.Nullable(legalEntityInput)),
  settings: t.Optional(
    t.Object({
      documentPrefix: t.Optional(t.String({ minLength: 1, maxLength: 10 })),
      invoicePrefix: t.Optional(t.String({ minLength: 1, maxLength: 10 })),
      taxExempt: t.Optional(t.Boolean()),
    }),
  ),
});

// Modèles nommés exposés dans le contrat (components.schemas).
export const identityModels = {
  Identity: identitySchema,
  Site: siteSchema,
  LegalEntity: legalEntitySchema,
  Country: countrySchema,
  CountryList: t.Array(countrySchema),
};
