# ADR-0006 — Sécurité visibilité catalogue : 404 vs 403, `adminOnly`

Statut : accepté · 2026-07-15
Portée : échoppe

## Contexte

Le storefront lit le catalogue public ; l'admin voit tout. Il faut cacher l'existence des ressources
non publiées sans divulguer, et réserver les endpoints privilégiés — sachant que le rôle **Public
possède `product:read`** (le storefront lit le catalogue).

## Options envisagées

- Tout en 403 — révèle l'existence de la ressource (énumération de slugs).
- Endpoint unique avec filtrage conditionnel partout — simple mais mélange projections public/admin.
- Endpoints séparés partout — duplication et N consommateurs admin à migrer.

## Décision

- **404 vs 403** : cacher une **ressource** filtrée par état (produit `draft`, catégorie/collection
  `isVisible=false`) → **404** anonyme (indistinguable de l'inexistant). Refuser un **endpoint**
  privilégié connu → **403**.
- **Deux patrons** : *endpoints séparés* quand la projection/params diffèrent (ex. `/products` publié
  vs `/products/admin` + `/products/:id/full` avec `costPrice`/`lowStockThreshold`) ; *filtrage
  conditionnel* `isPrivilegedRequest()` quand seule la visibilité de lignes diffère (catégories,
  collections).
- **Piège RBAC** : `permission: true` + `product:read` ne réserve **pas** à l'admin (Public l'a) →
  `permissionGuard(resource, action, { adminOnly: true })` (exige `type === 'admin' | 'apikey'`).

## Conséquences

- Le SDK `@echoppe/client` = surface publique uniquement (cf. ADR-0007).
- `variantPublicSchema` omet `costPrice`/`lowStockThreshold` (cf. ADR-0009, item B10 low-stock).

## Détail

→ [security-audit.md](../audits/security-audit.md), [audit-rbac-plan.md](../audits/audit-rbac-plan.md)
