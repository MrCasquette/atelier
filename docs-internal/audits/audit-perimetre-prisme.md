# Périmètre Prisme — inventaire du monorepo existant

> **Factuel, aucune décision.** Ce document mesure ce qui, dans le monorepo actuel, constituerait
> Prisme. Les décisions qui en découlent vivent dans les ADR — [0026](../adr/ADR-0026-sections-entites.md)
> à [0036](../adr/ADR-0036-cycle-de-vie-contenu.md).
>
> Relevé le 2026-08-01, avant toute extraction.

## Le résultat qui compte

Un grep des termes du commerce (`product`, `catalog`, `order`, `cart`, `customer`, `payment`,
`shipping`, `stock`, `invoice`…) sur les **21 fichiers réputés génériques** ne remonte que des **faux
positifs** — `orderBy`, `sortOrder`.

Le socle est nettement plus découplé que la taille du repo ne le laissait craindre. Les couplages
réels sont **cinq**, et ils sont localisés.

## Réutilisable tel quel

| Brique | Fichiers | Note |
|---|---|---|
| **Média** | `schema/media.ts` (31 l.), `routes/media.ts` (510 l.), `routes/assets.ts`, composables `media/`, `MediaView.vue` | **zéro dépendance sortante** (`folder.parent` est auto-référent). Seul défaut interne : `node:fs` et `UPLOAD_DIR` en dur, pas de port de stockage |
| **Communication** | `schema/communication.ts`, `adapters/communication/*` (7 f.), `routes/communications.ts` | l'adapter est propre ; la couche au-dessus ne l'est pas (cf. couplages) |
| **Audit** | `schema/admin.ts` → `auditLog`, `routes/audit-logs.ts`, `lib/audit.ts`, composables `audit/` | générique par construction — `entityType` est un varchar libre |
| **Clés d'API** | `schema/admin.ts` → `apiKey`, `plugins/apiKey.ts`, `routes/api-keys.ts` | scopes en jsonb, aucun scope commerce codé |
| **Contenu** | `schema/content.ts` (80 l.), `routes/content.ts` + `pages.ts`, `services/content-registry.ts`, composables `content/` sauf 2 | **le cœur de Prisme**, et il est presque propre |
| **DSL** | `packages/content/*` — déjà `@mrcasquette/content` | agnostique sauf `RefTarget` |
| **Utilitaires** | `utils/{pagination,responses,url-validation,rate-limit,image-ref}.ts`, `packages/shared` | |
| **Crypto** | `utils/crypto.ts`, `adapters/credential-store.ts` | l'abstraction DIP est déjà en place |

## Les cinq couplages

| # | Emplacement | Nature |
|---|---|---|
| 1 | `models/content.ts:24` | `refTarget = 'product' \| 'collection' \| 'category'` |
| 2 | `packages/content/src/types.ts:74` | même union, **dans le paquet publié** |
| 3 | `models/menu.ts` | même union **3 fois** — l. 20-22, l. 54, l. 72-74 |
| 4 | `services/menu-resolve.ts` | fichier entier : importe `product`, `collection`, `category` du core, 3 requêtes de projection |
| 5 | `composables/content/useCatalogRef.ts` | contrepartie admin |

→ Traités par [ADR-0032](../adr/ADR-0032-cibles-referencables.md), tâche #8.

**Deux couplages hors menus :**

- `schema/admin.ts` → `company` mêle identité légale et numérotation de factures
  (`documentPrefix`, `documentNextNumber`, `invoicePrefix`, `invoiceNextNumber`, `taxExempt`).
  → [ADR-0034](../adr/ADR-0034-identite-referentiel-reglages.md), tâche #9.
- `adapters/communication/templates.ts` code en dur `order-confirmation`, `shipment`, `welcome` ;
  `services/email.ts` expose `sendOrderConfirmation` / `sendShipmentNotification`. L'adapter est
  agnostique, la couche au-dessus ne l'est pas. → tâche #7.

## Blocages mécaniques

- **`schema/enums.ts`** (65 l.) — sac global d'une vingtaine de `pgEnum` mêlant tous les domaines.
  **Blocage n°1** de toute extraction. → tâche #2.
- **`constants/resources.ts`** — `RESOURCES` énumère en dur `PRODUCT`, `CATEGORY`, `COLLECTION`,
  `VARIANT`, `ORDER`, `CART`, `WISHLIST`, `INVOICE`, `STOCK`, `SHIPPING_PROVIDER`,
  `PAYMENT_CONFIG`… soit **14 des 24 entrées** liées au commerce, dans ce qui devrait être du RBAC
  générique.
- **`plugins/rbac.ts`** — `AuthenticatedCustomer` est citoyen de premier rang du contexte d'auth
  (l. 29-51), avec un cache `customerRoleId` dédié. `roleScopeEnum = ['admin', 'store']` : le mot
  « store » est dans l'enum DB.

Les deux derniers relèvent du **sujet auth**, traité séparément — [ADR-0008](../adr/ADR-0008-auth-sessions.md)
et [ADR-0013](../adr/ADR-0013-modele-rbac.md) sont marqués « à relire pour Prisme ».

## Hors périmètre — commerce pur

10 schémas : `catalog` (248 l.), `customer` (96), `orders` (52), `payment` (46), `shipping` (39),
`engagement` (36), `document` (36), `cart` (29), `stock` (14), et `referential.taxRate`.

20 fichiers de routes sur 30, soit **~5 500 lignes sur 8 053**. Les adapters `payment/` et
`shipping/`, `services/{checkout,invoice}`, `templates/invoice.typ`, et environ 12 des 28 vues admin.

## Ce qui manque entièrement

| Besoin | État | Décision |
|---|---|---|
| Types de contenu répétables | absent — le modèle est `page → sections`, pas de « collection d'articles » | → entités, [ADR-0027](../adr/ADR-0027-entites-tables-reelles.md) |
| Versionnement / révisions | absent | **écarté**, [ADR-0036](../adr/ADR-0036-cycle-de-vie-contenu.md) |
| Prévisualisation d'un brouillon | absent | question ouverte, [ADR-0036](../adr/ADR-0036-cycle-de-vie-contenu.md) |
| i18n de contenu | absent | décidé non implémenté, [ADR-0031](../adr/ADR-0031-i18n-champs-localises.md) |
| Publication planifiée | absent | hors périmètre, [ADR-0036](../adr/ADR-0036-cycle-de-vie-contenu.md) |
| Rendu générique du contenu | absent | V2, [ADR-0029](../adr/ADR-0029-rendu-generique.md) |

## Méthode retenue

Extraire **en visant Prisme** — le produit le plus simple spécifie les briques — plutôt qu'en
cherchant « le commun des deux ». La première extraction sert de sonde : `media` a zéro dépendance
sortante, c'est le cas le plus favorable, donc le bon test de l'outillage (tâche #3).

Critère de réussite, automatique : `db:generate` reste silencieux des deux côtés, type-check et lint
verts, garde de contrat vert.
