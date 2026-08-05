import { t } from 'elysia';

// Schéma d'entité adresse client — SOURCE UNIQUE. Importé par la route (par valeur, pour
// l'array de liste) ET agrégé dans `addressModels` → peuple `components.schemas`.

export const addressSchema = t.Object({
  id: t.String({ format: 'uuid', description: "Identifiant unique de l'adresse." }),
  type: t.Union([t.Literal('shipping'), t.Literal('billing')], {
    description: 'Type d’adresse : livraison ou facturation.',
  }),
  label: t.Nullable(t.String({ description: 'Libellé personnalisé (ex. « Domicile »).' })),
  firstName: t.String({ description: 'Prénom du destinataire.' }),
  lastName: t.String({ description: 'Nom du destinataire.' }),
  company: t.Nullable(t.String({ description: 'Société (optionnel).' })),
  street: t.String({ description: 'Rue et numéro.' }),
  street2: t.Nullable(t.String({ description: "Complément d'adresse." })),
  postalCode: t.String({ description: 'Code postal.' }),
  city: t.String({ description: 'Ville.' }),
  country: t.Object(
    {
      id: t.String({ format: 'uuid', description: 'UUID du pays.' }),
      name: t.String({ description: 'Nom du pays.' }),
      code: t.String({ description: 'Code ISO du pays (ex. « FR »).' }),
    },
    { description: 'Pays de l’adresse.' },
  ),
  phone: t.Nullable(t.String({ description: 'Téléphone de contact pour la livraison.' })),
  isDefault: t.Boolean({ description: 'Adresse par défaut pour ce type.' }),
});

// Modèles nommés exposés dans le contrat (components.schemas).
export const addressModels = {
  Address: addressSchema,
  AddressList: t.Array(addressSchema),
};
