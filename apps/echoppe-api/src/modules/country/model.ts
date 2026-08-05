import { t } from 'elysia';

// Schéma d'entité pays — SOURCE UNIQUE. Le référentiel des pays est partagé entre les produits
// (ADR-0034) et ne dépend d'aucun concept de commerce : il vit dans son propre module, pas dans
// celui de l'identité du site avec lequel il ne partage qu'un écran d'administration.

export const countrySchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique du pays.' }),
  name: t.String({ description: 'Nom du pays.' }),
  code: t.String({ description: 'Code ISO du pays (ex. « FR »).' }),
});

// Modèles nommés exposés dans le contrat (components.schemas).
export const countryModels = {
  Country: countrySchema,
  CountryList: t.Array(countrySchema),
};
