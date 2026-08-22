# Audit surface compte / checkout (B6)

> **Constat à date (2026-07-19).** Ce document prouve de quoi on s'est inquiété, et quand. Il ne dit
> **pas** l'état courant, qui se redécouvre sur le code — la wishlist du manque #5, par exemple, est
> livrée depuis. Les manques encore ouverts sont suivis au
> [backlog Échoppe](../backlog/echoppe.md) § Compte et checkout. Les chemins cités sont ceux de
> 2026-07 : `apps/api/src/routes/` s'appelle depuis `apps/echoppe-api/src/modules/`.

Inventaire **existe / manque** de la surface storefront « compte client + tunnel de commande », à
partir des routes réelles. Lecture seule — aucun code modifié. Sert de base de décision avant
d'ouvrir les tâches de complétude (B7+).

## Surface existante

### Authentification (`/customer/auth`, `customer-auth.ts`)
| Endpoint | État | Note |
|---|---|---|
| `POST /customer/auth/register` | ✅ | Crée le compte **actif** + session. Pas de double opt-in (voir manques). |
| `POST /customer/auth/login` | ✅ | Rate-limité. Session cookie HTTP-only + User-Agent pinning. |
| `POST /customer/auth/logout` | ✅ | |
| `GET /customer/auth/me` | ✅ | Client courant. |
| `POST /customer/auth/refresh` | ✅ | Rotation du token de session. |
| `POST /customer/auth/password/forgot` | ✅ | Envoi email de réinitialisation. |
| `POST /customer/auth/password/reset` | ✅ | Réinitialisation par token. |
| `POST /customer/auth/password` | ✅ | Changement de mot de passe (client connecté). |

### Profil (`/customer`, `customer-account.ts`)
| Endpoint | État | Note |
|---|---|---|
| `PATCH /customer/profile` | ✅ | Mise à jour self-service (nom, etc.). |

### Adresses (`/customer/addresses`, `customer-addresses.ts`)
| Endpoint | État | Note |
|---|---|---|
| `GET /customer/addresses` | ✅ | Liste. |
| `GET /customer/addresses/:id` | ✅ | Détail. |
| `POST /customer/addresses` | ✅ | Création. `isDefault` gère l'adresse par défaut (désactive les autres du même type). |
| `PUT /customer/addresses/:id` | ✅ | Mise à jour + bascule `isDefault`. |
| `DELETE /customer/addresses/:id` | ✅ | Suppression. |

→ **CRUD complet**, gestion de l'adresse par défaut incluse (via `isDefault`, pas de route dédiée — suffisant).

### Commandes client (`/customer/orders`, `customer-orders.ts`)
| Endpoint | État | Note |
|---|---|---|
| `GET /customer/orders` | ✅ | Liste paginée des commandes du client connecté. |
| `GET /customer/orders/:id` | ✅ | Détail d'une commande (scopée au client). |

### Checkout (`/checkout`, `checkout.ts`)
| Endpoint | État | Note |
|---|---|---|
| `GET /checkout/payment-providers` | ✅ | Providers de paiement **actifs** (public). |
| `POST /checkout` | ✅ | Crée la commande + session de paiement. **Authentifié uniquement** (`customerAuth: true`). |

### Panier (`/cart`, `cart.ts`) — contexte
`GET /cart` · `POST /cart/items` · `PATCH /cart/items/:id` · `DELETE /cart/items/:id` · `DELETE /cart` ·
`POST /cart/merge` (fusion anon→login). ✅ Complet, anonyme + authentifié.

## Manques identifiés

| # | Manque | Criticité | Nature |
|---|---|---|---|
| 1 | **Checkout invité (guest)** — `POST /checkout` exige un compte (401 sinon). Impossible de commander sans s'inscrire. | 🔴 Élevée | **Décision produit** : imposer le compte, ou autoriser l'invité ? Beaucoup de boutiques perdent des ventes sur l'inscription forcée. |
| 2 | **Suivi de commande invité** (lookup par n° + email, sans session). | 🟠 Moyenne | Dépend de #1. Sans checkout invité, sans objet. |
| 3 | **Vérification d'email à l'inscription** (double opt-in). | 🟡 Faible | Compte actif immédiatement. Acceptable V1 ; à acter (spam/fraude). |
| 4 | **Suppression / export de compte (RGPD self-service)**. | 🟠 Moyenne | `customer-account.ts` porte déjà le commentaire « futur foyer RGPD (export + suppression) » — reconnu, non implémenté. Obligation légale UE. |
| 5 | **Wishlist**. | 🟡 Faible | = tâche **B7** (ressource RBAC `wishlist` repérée). Hors périmètre compte de base. |
| 6 | **Renvoi de l'email de confirmation d'inscription**. | ⚪ n/a | Sans objet tant que #3 n'est pas fait. |

## Lecture

Le **socle compte connecté est complet** : auth, profil, adresses (CRUD + défaut), commandes, checkout,
panier avec fusion anon→login. Les manques ne sont pas des trous d'implémentation mais des **décisions
produit** : #1 (checkout invité) est le seul à fort impact commercial et conditionne #2. #4 (RGPD) est
une échéance légale déjà anticipée dans le code.

Aucune action code dans cette tâche (audit). Ordre suggéré si on ouvre la complétude : trancher #1
(invité) → #4 (RGPD) → #3 (opt-in). #5 (wishlist) suit son propre item B7.
