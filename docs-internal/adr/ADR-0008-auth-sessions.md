# ADR-0008 — Auth : sessions Postgres (pas JWT), cookies HTTP-only, RBAC

Statut : accepté
Portée : auth

## Contexte

Le dashboard admin et les comptes clients ont besoin d'auth. Deux familles : sessions serveur
(révocables, stateful) vs jetons auto-portés (JWT, stateless). L'API a déjà Postgres ; Redis est
optionnel (rate-limit only, fail-open).

## Options envisagées

- **JWT** — stateless, mais révocation difficile, secret à gérer, pas de « logout » vrai.
- **Sessions Postgres + cookie HTTP-only** — révocables, simples, une requête indexée par token.

## Décision

- **Sessions serveur en Postgres** : table `session` (admin) et `customer_session` (clients), token
  opaque indexé, `expiresAt`. Cookie **HTTP-only** (`echoppe_admin_session`), lu par `authPlugin`
  (`getSessionFromToken` → join `session`/`user`/`role`). **Pas de JWT.**
- **RBAC** par rôle/permissions (`resource:action`) ; garde `permissionGuard(resource, action,
  { adminOnly })` (cf. ADR-0006). Clés d'API = principal privilégié alternatif.

## Conséquences

- Les routes auth-gated sont **testables sans Redis** : injecter `user` + `role` + `session` en base
  et passer le cookie à `app.handle` (utile pour le filet de test, cf. Phase 3 du plan storefront).
- Le login passe par le rate-limit (`utils/rate-limit.ts`) qui **tente Redis** : sans `REDIS_URL`, il
  dégrade (fail-open) mais peut ralentir/bloquer en environnement de test → préférer l'injection de
  session directe plutôt que l'endpoint `/auth/login` dans les tests.

## Détail

→ [api-keys.md](../architecture/cles-api.md) (principal clé d'API), [audit-rbac-plan.md](../audits/audit-rbac-plan.md).
