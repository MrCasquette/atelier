# Classification des routes par audience

But de ce document : **décider quelles routes entrent dans le SDK boutique (`@echoppe/client`)**.
Le SDK est consommé par un storefront e-commerce ; il ne doit exposer que la surface
utile au front public/client. Les routes admin restent servies par l'API (et consommées
par l'app Admin via Eden Treaty), mais **n'ont pas à figurer dans le contrat public** :
inutiles au front, elles alourdissent le SDK et sa documentation.

Ce document ne remplace pas le RBAC : le **RBAC est la garde runtime** (voir plus bas).
La sélection SDK est une frontière de *contrat/type*, complémentaire.

## Légende

- **Audience**
  - `public` — storefront, aucune authentification (lecture catalogue, panier par cookie de session…).
  - `client` — storefront, **session client** requise (`customerAuth`).
  - `admin` — back-office, **RBAC** requis (`permission`).
  - `infra` — appelé par un tiers (webhook PSP), vérifié par signature.
- **Garde** — mécanisme runtime effectif :
  - `—` public ; `customerAuth:true` (plugin `customerAuth`) ; `permission:true` (`permissionGuard(resource, action)`) ; `signature` (vérif webhook).
- **SDK** — ✅ candidat au SDK boutique · ❌ hors périmètre · ⬜ à trancher.

## Mécanismes de garde (RBAC)

Deux macros, activées **route par route** (une route sans macro n'est pas gardée) :

| Mécanisme | Plugin | Macro | Pour |
|---|---|---|---|
| RBAC admin | `permissionGuard(resource, action)` | `permission: true` | back-office (par **rôle**) |
| Auth client | `customerAuthPlugin` | `customerAuth: true` | espace client storefront |

**Audit (2026-07) : sain.** Toutes les mutations sensibles portent une macro de garde.
Les mutations sans garde sont légitimement publiques : panier (cookie de session +
vérification d'ownership), login/register (rate-limit), formulaire de contact, webhooks
PSP (signature). Aucune route de mutation orpheline détectée.

## Storefront — `public` (SDK ✅)

| Méthode | Path | Groupe | SDK |
|---|---|---|---|
| GET | `/assets/:id` | assets (images publiques) | ✅ |
| GET | `/products/` | products | ✅ |
| GET | `/products/by-slug/:slug` | products | ✅ |
| GET | `/products/:id` | products | ✅ |
| GET | `/products/:id/variants` | products | ✅ |
| GET | `/products/:id/media` | products | ✅ |
| GET | `/categories/` | categories | ✅ |
| GET | `/categories/:id` | categories | ✅ |
| GET | `/categories/by-slug/:slug` | categories | ✅ |
| GET | `/categories/:id/products` | categories | ✅ |
| GET | `/collections/` | collections | ✅ |
| GET | `/collections/:id` | collections | ✅ |
| GET | `/collections/by-slug/:slug` | collections | ✅ |
| GET | `/collections/:id/products` | collections | ✅ |
| GET | `/cart/` | cart | ✅ |
| POST | `/cart/items` | cart | ✅ |
| PATCH | `/cart/items/:id` | cart | ✅ |
| DELETE | `/cart/items/:id` | cart | ✅ |
| DELETE | `/cart/` | cart | ✅ |
| POST | `/cart/merge` | cart | ✅ |
| GET | `/checkout/payment-providers` | checkout | ✅ |
| GET | `/company/` | company (infos légales) | ✅ |
| GET | `/tax-rates/` | tax-rates | ✅ |
| GET | `/countries/` | countries (pays livrables, formulaires d'adresse) | ✅ |
| POST | `/contact/` | contact (formulaire) | ✅ |

## Storefront — `client` authentifié (SDK ✅, `customerAuth`)

| Méthode | Path | Groupe | SDK |
|---|---|---|---|
| POST | `/customer/auth/register` | customer-auth (rate-limit) | ✅ |
| POST | `/customer/auth/login` | customer-auth (rate-limit) | ✅ |
| POST | `/customer/auth/logout` | customer-auth | ✅ |
| POST | `/customer/auth/refresh` | customer-auth | ✅ |
| GET | `/customer/auth/me` | customer-auth | ✅ |
| POST | `/customer/auth/password` | customer-auth | ✅ |
| POST | `/customer/auth/password/forgot` | customer-auth (rate-limit, public) | ✅ |
| POST | `/customer/auth/password/reset` | customer-auth (rate-limit, public) | ✅ |
| PATCH | `/customer/profile` | customer-account | ✅ |
| GET | `/customer/addresses/` | customer-addresses | ✅ |
| GET | `/customer/addresses/:id` | customer-addresses | ✅ |
| POST | `/customer/addresses/` | customer-addresses | ✅ |
| PUT | `/customer/addresses/:id` | customer-addresses | ✅ |
| DELETE | `/customer/addresses/:id` | customer-addresses | ✅ |
| GET | `/customer/orders/` | customer-orders | ✅ |
| GET | `/customer/orders/:id` | customer-orders | ✅ |
| POST | `/checkout/` | checkout | ✅ |
| POST | `/payments/checkout` | payments | ✅ |

## Admin — `permission` (SDK ❌)

Groupes intégralement admin (toutes routes `permission:true`) :

| Groupe | Routes | Ressource RBAC |
|---|---|---|
| audit-logs | GET `/`, `/actions`, `/entity-types` | `audit_log:read` |
| auth (admin) | GET `/auth/me`, POST `/auth/login`, `/auth/logout` | session admin |
| customers | GET `/`, `/:id` ; PATCH `/:id`, `/:id/status` ; DELETE `/:id` | `customer:*` |
| media | folders + assets CRUD (11 routes) | `media:*` |
| orders | GET `/`, `/:id`, `/stats`, `/:id/invoices`, `/:id/invoices/:invoiceId/pdf` ; PATCH `/:id/status`, `/:id/notes` ; POST `/:id/invoice` | `order:*` |
| roles | resources + roles CRUD + permissions | `role:*`, `permission:*` |
| shipping | providers config + `POST /rates` + `GET /tracking/:n` + `POST /labels` | `shipping_provider:*` |
| stock | GET (3) + 1 mutation | `stock:*` (à confirmer) |
| communications | providers config + test | `communication_config:*` |
| users | CRUD utilisateurs admin | `user:*` |

Routes admin **au sein de groupes mixtes** :

| Méthode | Path | Groupe |
|---|---|---|
| GET | `/products/options` (liste globale des options) | products |
| POST/PUT/PATCH/DELETE | `/products/*` (produits, variants, options, media) | products |
| POST/PUT/DELETE | `/categories/*` | categories |
| POST/PUT/DELETE | `/collections/*` | collections |
| GET | `/company/countries` · PUT `/company/` | company |
| GET | `/payments/providers` · PUT `/payments/providers/*` | payments |
| GET | `/payments/:orderId` (statut) · POST `/payments/:orderId/refund` | payments |

## Infra — `webhook` (SDK ❌, signature)

| Méthode | Path | Vérification |
|---|---|---|
| POST | `/payments/webhook/:provider` | signature vérifiée par l'adapter du provider (`stripe`, `paypal`, …) — rate-limit IP dédié |

## Angles morts identifiés (→ backlog features API)

- ~~**Espace commandes client absent**~~ ✅ **fait (2026-07)** : `GET /customer/orders/` et
  `GET /customer/orders/:id` (groupe `customer-orders`, gardés `customerAuth`, filtrés sur
  `order.customer = currentCustomer.id`). Projection storefront `Order`/`OrderList`
  (`src/models/order.ts`) : sans `internalNote`, paiement et expédition allégés (pas de
  référence transaction ni de poids colis). La vue admin `orders/*` reste inchangée.
- ~~**Self-update du profil client absent**~~ ✅ **fait (2026-07)** : `PATCH /customer/profile`
  (nom/téléphone/optin, groupe `customer-account`), `POST /customer/auth/password`
  (changement connecté, révoque les autres sessions), `POST /customer/auth/password/forgot`
  + `/reset` (mot de passe oublié : jeton hashé usage unique TTL 1h, email via
  `sendResetPasswordEmail`, lien `STORE_URL/reset-password`). **Reste** : changement d'email
  (flux vérifié dédié) + suppression de compte RGPD (feature à part, cf. `BACKLOG.md`).
- **Frais de port / suivi côté client** : `POST /shipping/rates` et
  `GET /shipping/tracking/:n` sont admin. À exposer au storefront via des routes dédiées
  (frais = public pour estimer ; suivi = `customerAuth`), ou garder le calcul interne au
  service checkout. = feature à créer, pas un simple tag d'audience.

## Backlog RBAC — granularité (au-delà du niveau route)

Le RBAC actuel est **par rôle, au niveau route** (accès binaire à l'endpoint). À prévoir :

- **Granularité par champ** : masquer certains champs selon le rôle (ex. un non-admin ne
  reçoit pas `costPrice`/marge dans un variant). N'existe pas encore.
- **Masquage par ownership** : `if user === currentUser → vue complète, sinon → champs
  sensibles masqués` (ex. un client voit sa commande en entier, pas celle d'un autre).

Ces deux points sont la future **frontière de forme** (projections storefront vs admin
d'une même entité). À traiter après la séparation de surface, entité par entité.

**Amorce faite (2026-07)** : `variantPublicSchema` = `t.Omit(variantSchema, ['costPrice',
'lowStockThreshold'])` est la projection storefront du variant, utilisée par
`variantDetailSchema` (→ `ProductDetail`/`ProductWithVariants`) et `GET /products/:id/
variants`. `costPrice` (marge) et `lowStockThreshold` ne fuitent plus dans le contrat
public ; la vue admin `variantSchema` (modèle nommé `Variant`) les conserve. Le nettoyage
est assuré par Elysia, qui strippe les champs absents du schéma de réponse (vérifié).
