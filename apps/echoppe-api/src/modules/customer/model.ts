import { t } from 'elysia';

// Schéma d'entité client (profil) — SOURCE UNIQUE. Agrégé dans `customerModels` → peuple
// `components.schemas`. La réponse de `GET /customer/auth/me` enveloppe le profil dans
// `{ customer }` ; on nomme la réponse entière (`CustomerAuth`) car un nom de modèle n'est
// pas référençable via `t.Ref` à l'intérieur d'un wrapper (cf. contrainte connue).

export const customerSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique du client.' }),
  email: t.String({ format: 'email', description: 'Adresse e-mail du client.' }),
  firstName: t.String({ description: 'Prénom.' }),
  lastName: t.String({ description: 'Nom.' }),
  phone: t.Nullable(t.String({ description: 'Numéro de téléphone.' })),
  emailVerified: t.Boolean({ description: "L'adresse e-mail a été vérifiée." }),
  marketingOptin: t.Boolean({ description: 'Consentement aux communications marketing.' }),
});

// Réponse de connexion — profil réduit (pas de champs profil complets, juste l'identité).
export const loginResultSchema = t.Object({
  customer: t.Object({
    id: t.String({ format: 'uuid', description: 'Identifiant unique du client.' }),
    email: t.String({ format: 'email', description: 'Adresse e-mail du client.' }),
    firstName: t.String({ description: 'Prénom.' }),
    lastName: t.String({ description: 'Nom.' }),
  }),
});

// Modèles nommés exposés dans le contrat (components.schemas).
export const customerModels = {
  Customer: customerSchema,
  CustomerAuth: t.Object({ customer: customerSchema }),
  LoginResult: loginResultSchema,
};
