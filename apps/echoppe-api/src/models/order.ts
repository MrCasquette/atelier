import { t } from 'elysia';
import { listResponse } from '../utils/pagination';

// Projection STOREFRONT d'une commande — vue du client connecté sur SES propres commandes.
// Volontairement plus pauvre que la vue admin (routes/orders.ts) : pas de `internalNote`
// (note interne boutique), paiement et expédition allégés (pas de référence transaction ni
// de poids colis). SOURCE UNIQUE, agrégée dans `orderModels` → peuple components.schemas.

const orderStatusSchema = t.Union(
  [
    t.Literal('pending'),
    t.Literal('confirmed'),
    t.Literal('processing'),
    t.Literal('shipped'),
    t.Literal('delivered'),
    t.Literal('cancelled'),
    t.Literal('refunded'),
  ],
  { description: 'Statut de la commande.' },
);

// Ligne de commande (snapshot au moment de l'achat).
const orderItemSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique de la ligne.' }),
  variant: t.Nullable(
    t.String({
      format: 'uuid',
      description: 'UUID de la variante achetée (null si la variante a depuis été supprimée).',
    }),
  ),
  label: t.String({
    description: 'Libellé du produit tel qu’acheté (ex. « Bague Lune — Argent / 52 »).',
  }),
  quantity: t.Number({ description: 'Quantité commandée.' }),
  unitPriceHt: t.String({ description: 'Prix unitaire HT (chaîne décimale).' }),
  taxRate: t.String({ description: 'Taux de TVA appliqué, en pourcentage (chaîne décimale).' }),
  totalHt: t.String({ description: 'Total HT de la ligne (chaîne décimale).' }),
  totalTtc: t.String({ description: 'Total TTC de la ligne (chaîne décimale).' }),
});

// Paiement associé — vue client allégée (pas de référence transaction interne).
const orderPaymentSchema = t.Nullable(
  t.Object(
    {
      provider: t.String({ description: 'Prestataire de paiement (ex. « stripe », « paypal »).' }),
      status: t.String({ description: 'Statut du paiement.' }),
      amount: t.String({ description: 'Montant payé (chaîne décimale).' }),
      dateCreated: t.Date({ description: 'Date du paiement.' }),
    },
    { description: 'Paiement de la commande, ou null si non réglée.' },
  ),
);

// Expédition associée — suivi côté client (pas de poids ni d'identifiants internes).
const orderShipmentSchema = t.Nullable(
  t.Object(
    {
      status: t.String({ description: 'Statut de l’expédition.' }),
      trackingNumber: t.Nullable(t.String({ description: 'Numéro de suivi transporteur.' })),
      trackingUrl: t.Nullable(t.String({ description: 'URL de suivi transporteur.' })),
      shippedAt: t.Nullable(t.Date({ description: 'Date d’expédition.' })),
      deliveredAt: t.Nullable(t.Date({ description: 'Date de livraison.' })),
      provider: t.Object(
        {
          name: t.String({ description: 'Nom du transporteur (ex. « Colissimo »).' }),
          type: t.String({ description: 'Type de transporteur (ex. « colissimo »).' }),
        },
        { description: 'Transporteur.' },
      ),
    },
    { description: 'Expédition de la commande, ou null si non expédiée.' },
  ),
);

// Élément de liste (aperçu) — sous-ensemble affiché dans l'espace commandes.
const orderListItemSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique de la commande.' }),
  orderNumber: t.String({ description: 'Numéro de commande lisible (ex. « CMD-2025-00001 »).' }),
  status: orderStatusSchema,
  totalTtc: t.String({ description: 'Total TTC de la commande (chaîne décimale).' }),
  dateCreated: t.Date({ description: 'Date de création de la commande.' }),
});

// Détail complet d'une commande du client connecté.
export const orderSchema = t.Object({
  id: t.String({ format: 'uuid', description: 'Identifiant unique de la commande.' }),
  orderNumber: t.String({ description: 'Numéro de commande lisible (ex. « CMD-2025-00001 »).' }),
  status: orderStatusSchema,
  shippingAddress: t.Any({ description: 'Adresse de livraison figée au moment de la commande.' }),
  billingAddress: t.Any({ description: 'Adresse de facturation figée au moment de la commande.' }),
  subtotalHt: t.String({ description: 'Sous-total HT des articles (chaîne décimale).' }),
  shippingHt: t.String({ description: 'Frais de port HT (chaîne décimale).' }),
  discountHt: t.String({ description: 'Remise HT appliquée (chaîne décimale).' }),
  totalHt: t.String({ description: 'Total HT (chaîne décimale).' }),
  totalTax: t.String({ description: 'Montant total de TVA (chaîne décimale).' }),
  totalTtc: t.String({ description: 'Total TTC (chaîne décimale).' }),
  customerNote: t.Nullable(t.String({ description: 'Note laissée par le client à la commande.' })),
  dateCreated: t.Date({ description: 'Date de création de la commande.' }),
  dateUpdated: t.Date({ description: 'Date de dernière mise à jour.' }),
  items: t.Array(orderItemSchema, { description: 'Lignes de la commande.' }),
  payment: orderPaymentSchema,
  shipment: orderShipmentSchema,
});

// Modèles nommés exposés dans le contrat (components.schemas).
export const orderModels = {
  Order: orderSchema,
  OrderList: listResponse(orderListItemSchema),
};
