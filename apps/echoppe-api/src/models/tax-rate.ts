import { t } from 'elysia';

// Schéma d'entité taux de TVA — SOURCE UNIQUE. Importé par la route (par valeur, pour
// l'array) ET agrégé dans `taxRateModels` → peuple `components.schemas` du contrat OpenAPI.

export const taxRateSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique du taux de TVA.' }),
  name: t.String({ description: 'Nom du taux (ex. « TVA 20 % »).' }),
  rate: t.String({ description: 'Taux en pourcentage, décimal en chaîne (ex. « 20.00 »).' }),
  isDefault: t.Boolean({ description: 'Taux appliqué par défaut aux nouveaux produits.' }),
});

// Modèles nommés exposés dans le contrat (components.schemas).
export const taxRateModels = {
  TaxRate: taxRateSchema,
  TaxRateList: t.Array(taxRateSchema),
};
