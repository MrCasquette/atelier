import { t } from 'elysia';

// Schémas d'entité du domaine entreprise — SOURCE UNIQUE. Importés par la route (par valeur,
// pour l'union GET / et l'array countries) ET agrégés dans `companyModels` → peuplent
// `components.schemas`. Les infos entreprise = mentions légales publiques (pas de champ
// sensible type coût/marge) → exposables au storefront.

export const companySchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique de la fiche entreprise.' }),
  shopName: t.String({ description: 'Nom commercial de la boutique.' }),
  logo: t.Nullable(t.String({ format: 'uuid', description: 'UUID du média du logo.' })),
  publicEmail: t.String({ format: 'email', description: 'E-mail de contact public.' }),
  publicPhone: t.Nullable(t.String({ description: 'Téléphone de contact public.' })),
  legalName: t.String({ description: 'Raison sociale (dénomination légale).' }),
  legalForm: t.Nullable(t.String({ description: 'Forme juridique (ex. « SARL »).' })),
  siren: t.Nullable(t.String({ description: 'Numéro SIREN (9 chiffres).' })),
  siret: t.Nullable(t.String({ description: 'Numéro SIRET (14 chiffres).' })),
  tvaIntra: t.Nullable(t.String({ description: 'Numéro de TVA intracommunautaire.' })),
  rcsCity: t.Nullable(t.String({ description: "Ville d'immatriculation au RCS." })),
  shareCapital: t.Nullable(t.String({ description: 'Capital social, décimal en chaîne.' })),
  street: t.String({ description: 'Rue et numéro du siège.' }),
  street2: t.Nullable(t.String({ description: "Complément d'adresse." })),
  postalCode: t.String({ description: 'Code postal.' }),
  city: t.String({ description: 'Ville.' }),
  country: t.String({ format: 'uuid', description: 'UUID du pays du siège.' }),
  documentPrefix: t.String({ description: 'Préfixe des numéros de documents (ex. « REC »).' }),
  invoicePrefix: t.String({ description: 'Préfixe des numéros de factures (ex. « FA »).' }),
  taxExempt: t.Boolean({ description: 'Franchise de TVA (art. 293 B).' }),
  publisherName: t.Nullable(t.String({ description: 'Nom du directeur de la publication.' })),
  hostingProvider: t.Nullable(t.String({ description: "Nom de l'hébergeur du site." })),
  hostingAddress: t.Nullable(t.String({ description: "Adresse de l'hébergeur." })),
  hostingPhone: t.Nullable(t.String({ description: "Téléphone de l'hébergeur." })),
});

export const countrySchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique du pays.' }),
  name: t.String({ description: 'Nom du pays.' }),
  code: t.String({ description: 'Code ISO du pays (ex. « FR »).' }),
});

// Modèles nommés exposés dans le contrat (components.schemas).
export const companyModels = {
  Company: companySchema,
  Country: countrySchema,
  CountryList: t.Array(countrySchema),
};
