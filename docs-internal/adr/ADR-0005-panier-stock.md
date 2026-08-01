# ADR-0005 — Panier & stock : capture manuelle Stripe + garde atomique Postgres

Statut : accepté · 2026-07-05
Portée : échoppe

## Contexte

Panier serveur déjà en DB (`cart` + `cart_item`, statut `active/converted/abandoned`, lié au customer
via `customerSession`). Décrément stock au paiement **sans garde** (`UPDATE variant SET quantity =
quantity - qty` sans `WHERE quantity >= qty`) → **survente possible**. Boutiques Échoppe = beaucoup de
**pièces uniques** → collisions fréquentes sur le dernier exemplaire. Une colonne `variant.reserved`
existait mais n'était jamais écrite (fausse protection).

## Options envisagées

- **Réservation maison** (`reserved`, `available = quantity - reserved`) — à brancher, mais réinvente
  ce que Stripe fait déjà avec une autorisation.
- **Capture immédiate** — débite avant de savoir si le stock tient → remboursements.
- **Capture manuelle Stripe + garde atomique Postgres** — l'autorisation tient l'empreinte, le stock
  tranche.
- **Queue BullMQ** — surdimensionné (Redis présent mais rate-limit only).

## Décision

- Checkout Session `payment_intent_data.capture_method: 'manual'` → autorisation, pas de débit.
- Webhook → **décrément atomique gardé** (`UPDATE ... WHERE quantity >= qty` + check `rowCount`) :
  OK → `paymentIntents.capture()` + commande ; KO → `paymentIntents.cancel()` + rupture (perdant
  jamais débité). **Idempotence** : court-circuit `status === 'completed'` + verrou `FOR UPDATE`.
- L'autorisation Stripe **remplace** la réservation maison → échafaudage `reserved` **retiré**.
- BullMQ écarté (palier lointain seulement si drops à forte concurrence).

## Conséquences

- Implémenté (survente corrigée, idempotence webhook, capture manuelle + fallback `refund()` PayPal) ;
  type-check + lint verts, **e2e Stripe CLI à prévoir avant prod**.
- Reste : page retour `success_url` pilotée par le **statut réel commande** (côté store), pas fait.
- Moyens de paiement : carte/Apple/Google Pay OK avec capture manuelle ; SEPA/BNPL → fallback capture
  immédiate + refund, à cadrer.
