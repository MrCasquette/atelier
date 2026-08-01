# ADR-0013 — Modèle RBAC (rôles / permissions)

Statut : accepté
Portée : socle

## Contexte

L'API sert plusieurs principaux (admins, clients, storefront anonyme, machines) avec des droits
différents par ressource. Il faut un contrôle d'accès lisible, administrable et performant. Distinct
d'ADR-0006 (règle 404 vs 403, `adminOnly`), qui s'appuie sur ce modèle.

## Options envisagées

- Rôles en dur dans le code — non administrable.
- Permissions par scopes portées par un jeton — pas de granularité par ressource administrable.
- Table `role` + table `permission` (`resource × {create,read,update,delete}`) résolues à la requête.

## Décision

- **`role`** (scope `admin`/`store`, `isSystem`) + **`permission`** (par `role` × `resource`, bits
  `canCreate/Read/Update/Delete`, `selfOnly`, `locked`), `unique(role, resource)`.
- **Rôles système** non supprimables : **Public** (storefront anonyme — possède `product:read`, d'où
  la nécessité d'`adminOnly`, cf. ADR-0006), **Client**, **Owner**.
- **Owner bypass** : un admin `isOwner` passe toute vérification.
- **Résolution** : `getAuthContext` (cookie/clé) → permissions du rôle, **cache mémoire 5 min** par
  rôle (`invalidatePermissionCache` après modification).
- `permissionGuard(resource, action, { adminOnly })` = macro Elysia posée par route.

## Conséquences

- Droits éditables sans redéploiement ; le cache impose une invalidation explicite après changement.
- Les clés d'API dérivent leurs permissions de leurs scopes, sans bypass owner (cf. ADR-0014).

## Détail

→ [audit-rbac-plan.md](../audits/audit-rbac-plan.md), [security-audit.md](../audits/security-audit.md)
