# ADR-0011 — Adapters de providers externes (paiement / livraison / communication)

Statut : accepté
Portée : adapters

## Contexte

Une boutique doit brancher des services tiers variables selon le commerçant : paiement (Stripe,
PayPal, virement, chèque), livraison (Colissimo, Mondial Relay, Sendcloud), email transactionnel
(Resend, Brevo, SMTP). Le cœur métier ne doit pas coupler sa logique à un provider particulier, et les
**secrets** (clés API) ne doivent jamais fuiter.

## Options envisagées

- Intégration directe d'un provider (ex. Stripe en dur) — simple mais non substituable.
- Couche d'abstraction par famille avec implémentations interchangeables, sélection par config.

## Décision

Un **adapter par famille**, structure uniforme sous `packages/core/src/adapters/<famille>/` :
- `types.ts` — l'interface commune (ex. `PaymentAdapter`, `CommunicationAdapter`) ;
- une implémentation par provider (`stripe.ts`, `paypal.ts`, `colissimo.ts`, `resend.ts`…) ;
- `config.ts` + `index.ts` — sélection/résolution du provider actif depuis la configuration en base.
- **Secrets chiffrés au repos** : les clés des `*_provider_config` sont chiffrées via
  `utils/crypto.ts` (clé `ENCRYPTION_KEY`), jamais stockées ni renvoyées en clair.
- Capacités **optionnelles** exprimées dans l'interface (ex. `capturePayment`/`cancelPayment` pour la
  capture manuelle Stripe, cf. ADR-0005 ; fallback `refund` pour PayPal).

## Conséquences

- Ajouter un provider = une entrée dans la SSOT de la famille (`PAYMENT_PROVIDERS` /
  `SHIPPING_PROVIDERS` / `COMMUNICATION_PROVIDERS`) + son adapter + une ligne dans la map du registre
  déclaratif (`createAdapterRegistry`). Les listings et schémas de route dérivent de la SSOT ; plus de
  `switch`, de singletons manuels ni de liste réénumérée route par route.
- (Historique) Ajouter un provider = une implémentation + son enregistrement, sans toucher le métier.
- La configuration provider (activation, secrets chiffrés) est administrable ; la CLI génère
  `ENCRYPTION_KEY` au scaffolding (cf. ADR-0002).
- Le contrat storefront ne dépend d'aucun provider (checkout via l'API, cf. ADR-0005).

## Frontière HTTP paiement — route webhook agnostique (2026-07-18)

Précision suite à revue : `apps/api/src/routes/payments.ts` n'est **pas** « le paiement » mais la
**frontière HTTP mince** entre nos acteurs et le provisionner (adapters). L'exécution du paiement est
entièrement déléguée au provider. Trois surfaces sont irréductiblement des routes : la création de
session checkout (clé secrète serveur + montant autoritaire), les webhooks (le provider NOUS
rappelle), la config/statut/refund admin.

- **SSOT providers** : `PAYMENT_PROVIDERS` (+ garde `isPaymentProvider`) dans
  `adapters/payment/types.ts` pilote listings et validation de route — plus d'enum codé en dur.
- **Webhook paramétrique** : une seule route `POST /payments/webhook/:provider` (au lieu d'une par
  provider). Chaque adapter **extrait et vérifie lui-même** ses headers de signature via
  `verifyWebhook(payload, headers)` — la route reste agnostique. Ajouter un provider (ex. Wero) =
  un adapter + une entrée dans `PAYMENT_PROVIDERS`, **zéro route**. Le chemin par provider reste
  identique (`/payments/webhook/stripe`), donc aucune URL webhook déjà configurée ne casse.
- **Rate-limit** : `webhookRateLimitOptions` (60/min/IP, fail-open sans Redis) sur une sous-instance
  `scoped` → borne la surface DoS de l'endpoint public sans affecter les routes admin voisines.

## Injection des credentials — DIP (2026-07-18)

Les adapters ne dépendent plus du module `config` concret (qui importe `db`) mais d'une abstraction
`CredentialStore<T>` (`get(): Promise<T | null>`) injectée au constructeur. Le registre injecte le
store réel (adossé à la base, credentials déchiffrés) ; un test injecte un stub.

- Débloque la **testabilité** de la couche adapter (paiement/livraison/communication) **sans base de
  données** — auparavant structurellement impossible (chaque adapter importait `config → db`).
  Premier verrou : `payment/stripe.test.ts` (isConfigured + webhook, aucune DB).
- `isConfigured()` s'appuie désormais sur `credentials.get() !== null` (les credentials ne sont non
  nuls que si le provider est activé ET déchiffrable) — légèrement plus strict que l'ancien
  `getProviderStatus` (qui ne déchiffrait pas).
- La communication reçoit `CommunicationCredentialStore` (credentials **+** config d'envoi), les deux
  autres familles le `CredentialStore<T>` générique.

## Settlement paiement — intention sur l'interface, mécanisme dans l'adapter (2026-07-18)

La différence de fonctionnement entre providers est **réelle** (Stripe autorise puis capture ;
PayPal encaisse à l'approbation) et doit rester **dans l'adapter** — le framework est agnostique.
On remplace donc les méthodes optionnelles `capturePayment?`/`cancelPayment?` (sur lesquelles
l'appelant branchait — violation LSP) par deux méthodes **obligatoires** exprimant l'intention :

- `capture(txId)` — finalise l'encaissement. Stripe : capture l'autorisation manuelle ; PayPal :
  no-op de succès (déjà capturé).
- `cancelOrRefund(txId)` — restitue les fonds (commande non honorée). Stripe : annule l'autorisation
  (aucun débit) ; PayPal : rembourse la capture.

`handlePaymentResult` appelle uniformément `capture`/`cancelOrRefund` sans connaître le provider ;
`refund(txId, amount?)` reste distinct pour le remboursement admin explicite. **Zéro changement de
comportement** — pure remise au propre de l'interface. Verrou : `paypal.test.ts` (capture no-op).
La question d'uniformiser PayPal sur `AUTHORIZE` (capture différée) est écartée : ce serait forcer
les providers à être identiques, alors que le but est d'assumer leur différence dans l'adapter.
