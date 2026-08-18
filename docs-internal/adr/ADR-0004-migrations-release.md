# ADR-0004 — Migrations au boot + validation release (sources vs artefact)

Statut : accepté · 2026-07-08 · politique de tags/versions affinée par [ADR-0023](./ADR-0023-versioning-tags.md) · validation amendée par [ADR-0054](./ADR-0054-ports-rang-de-pile.md) le 2026-08-18
Portée : socle

## Contexte

Une image opaque (ADR-0002) doit amener son schéma DB à jour toute seule chez l'hébergeur, sans étape
manuelle. En dev, itérer vite sur le schéma ne doit pas exiger de générer une migration à chaque fois.
Incident 0.4.0 : des colonnes poussées en dev via `db:push` sans migration générée manquaient dans
l'image → 500 en base vierge.

## Options envisagées

- Conteneur `init` dédié aux migrations — un service de plus, retiré du modèle lean.
- Migrer au boot de l'API, conditionné par un flag.
- `db:push` partout — dangereux en prod (drop de colonnes).

## Décision

- **L'API migre au boot** : `runMigrations()` (migrator postgres-js) appelé avant `.listen()` **si
  `RUN_MIGRATIONS`** (baké dans l'image, off en dev). Image embarque `packages/core/drizzle/`.
- **Dev = `db:push`** (rapide), **prod = migrations drizzle versionnées**. Discipline : après un
  changement de `schema/`, `bun run db:generate` + committer le SQL.
- **Validation release en deux temps** :
  1. Pré-publication → **sources** : `bun run test:integration` construit l'image depuis le working
     tree, la boote contre un Postgres neuf et vérifie migrations, idempotence, upgrade depuis n-1
     et parité du contrat SDK. *(Amendé le 2026-08-18 : ce rôle revenait à `compose.dev.yaml`, que
     le gate d'intégration couvre plus complètement ; cf. ADR-0054.)*
  2. Post-publication → **artefact** : `docker compose --profile release up -d` avec `VERSION=<x>`
     prouve que l'image publiée boot en base vierge.

## Conséquences

- Tests smoke « base vierge migrée » (`apps/api/tests/`, garde `ECHOPPE_SMOKE=1`, base jetable) =
  régression directe de l'incident 0.4.0.
- `echoppe-db` et `dpc-db` mappent tous deux le port 5432 → **conflit hôte** ; pour un test isolé,
  postgres éphémère jetable sur port libre, jamais la base `dpc-*` (prod).

## Détail

→ [release-runbook.md](../release/release-runbook.md)
