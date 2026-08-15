# `@repo/auth` — qui es-tu, et qu'as-tu le droit de faire

Authentification de la surface d'administration, registre de principaux, règles de droits, et les
définitions de tables qui vont avec.

## Frontière

**Aucune route, aucun plugin Elysia.** Les gardes (`authPlugin`, `permissionGuard`) appartiennent au
produit, parce qu'elles traduisent un refus en code HTTP
([ADR-0044](../../docs-internal/adr/ADR-0044-surface-http-paquets-partages.md)). Ce paquet répond
« a-t-il le droit ? » ; le produit décide que la réponse vaut 403.

Les définitions de tables sont livrées **comme définitions** : chaque cœur les inclut dans son barrel
et donc dans ses migrations ([ADR-0025](../../docs-internal/adr/ADR-0025-deux-produits-un-repo.md)).

**La session client n'est pas ici.** Elle est propre à Échoppe — un CMS n'a pas de clients.

## Le découpage qui compte : les règles pures, séparées de leur lecture

`permission.ts` porte les **règles** — qui peut quoi, qui peut déléguer quoi. Pures : aucune base,
aucun transport. `permission-cache.ts` porte leur **lecture en base** et son cache.

Cette séparation n'est pas cosmétique : `@repo/db` **lève à l'import** quand `DATABASE_URL` manque.
Un module qui l'importe entraîne toute sa dépendance avec lui, et devient intestable sans connexion.
Garder les règles à part est ce qui permet de les tester — et ce sont elles qu'il y a de plus
important à tester.

C'est la convention à suivre pour tout nouveau module de ce paquet.

## Le registre de principaux

Un « principal », c'est la réponse à *comment* tu es authentifié : session d'administration, session
client, clé d'API machine, anonyme. C'était une union fermée de quatre variantes, donc quatre
branches à traverser à chaque décision — et une branche morte garantie dans tout produit sans
clients. Le registre remplace l'union
([ADR-0037](../../docs-internal/adr/ADR-0037-principaux-surfaces.md)) ; l'autorité se lit par un
prédicat unique ([ADR-0047](../../docs-internal/adr/ADR-0047-autorite-principal.md)).

## À lire avant de toucher aux droits

- [ADR-0008](../../docs-internal/adr/ADR-0008-auth-sessions.md) — sessions Postgres, pas JWT
- [ADR-0013](../../docs-internal/adr/ADR-0013-modele-rbac.md) — modèle RBAC
- [ADR-0038](../../docs-internal/adr/ADR-0038-ressources-ouvertes-delegation.md) — ressources
  ouvertes, délégation, rôles système
- [ADR-0048](../../docs-internal/adr/ADR-0048-invitation-utilisateur.md) — le créateur ne connaît
  jamais le mot de passe

Ces deux premiers sont marqués comme **à relire à l'arrivée de Prisme** (ADR-0024) : un ADR socle qui
ne survit pas au deuxième produit n'était pas socle.

## Dépendances

`@repo/db`, `@repo/shared`, `drizzle-orm`, `elysia` (pour `t` uniquement).
