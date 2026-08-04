import { t } from 'elysia';

// Schémas d'entité du tunnel de commande — SOURCE UNIQUE. Importés par la route (par valeur,
// pour l'array de providers) ET agrégés dans `checkoutModels` → peuplent `components.schemas`.

export const providerInfoSchema = t.Object({
  id: t.String({ description: 'Identifiant du moyen de paiement (ex. « stripe », « paypal »).' }),
  name: t.String({ description: 'Nom affiché (ex. « Carte bancaire »).' }),
  description: t.String({ description: 'Courte description présentée au client.' }),
});

export const checkoutResultSchema = t.Object({
  orderId: t.String({ format: 'uuid', description: 'UUID de la commande créée.' }),
  orderNumber: t.String({ description: 'Numéro de commande lisible (ex. « CMD-2024-0001 »).' }),
  paymentUrl: t.String({ description: 'URL de redirection vers le paiement.' }),
  provider: t.String({ description: 'Moyen de paiement retenu.' }),
});

// Modèles nommés exposés dans le contrat (components.schemas).
export const checkoutModels = {
  PaymentProvider: providerInfoSchema,
  PaymentProviderList: t.Array(providerInfoSchema),
  CheckoutResult: checkoutResultSchema,
};
