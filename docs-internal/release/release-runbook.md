# Runbook release — invariant, post-mortem, durcissement

Notes internes sur la discipline de publication. Vue d'ensemble du pipeline (npm + images, gardes,
one-move) : [`pipeline-release.md`](./pipeline-release.md). Le « comment » pas-à-pas :
`docs/dev/releasing.md`. Ici on garde l'**invariant**, le **post-mortem** de l'incident 0.4.0 et le
**plan de tests** qui l'aurait attrapé.

## Invariant

> Pull image → migrate (base **vierge** ou **upgrade**) → `200` sur les routes clés,
> vérifié sur l'**artefact publié**, pas sur la base de dev.

Corollaire : `db:push` est du prototypage local. Il ne produit pas de migration donc
ne prouve **rien** sur ce que l'image embarque. La seule vérité de prod = le dossier
`packages/echoppe-core/drizzle/` appliqué au boot.

## Post-mortem — 0.4.0 (2026-07-17)

**Symptôme.** `echoppe-api:0.4.0` → `500` sur `/products/` (`select … option_value.metadata
… where option.type = 'color'`), `/countries/` → `200 []`. Toute boutique qui pull 0.4.0
obtient un backend cassé.

**Cause racine.** Le chantier options typées a ajouté `option.type` (enum) +
`option_value.metadata` (jsonb) au schéma, appliqués en dev via `db:push` **sans**
`db:generate`. Les migrations committées s'arrêtaient à 0005 → l'image 0.4.0 crée un
schéma sans ces colonnes. Drizzle réconcilie *migrations ↔ journal*, jamais
*schéma-du-code ↔ base* → « Schéma à jour » trompeur, cassé au seul runtime.
Secondairement, `country` (créée par migration mais peuplée uniquement par le
`db:seed` dev-only) restait vide en prod.

**Correctif (0.4.1).** Migration `0006_option_type_metadata_country_seed` :
`CREATE TYPE option_type`, `ADD COLUMN option.type`, `ADD COLUMN option_value.metadata`,
+ `INSERT` idempotent de la France (référentiel prod minimal, `ON CONFLICT (code) DO
NOTHING`). Validée base vierge (0000→0006) + idempotence. `db:generate` de contrôle :
« No schema changes » → dérive entièrement capturée. Le SDK n'était pas en cause (il
dérive de l'OpenAPI, juste en avance sur les migrations).

**Leçon.** Le faux vert vient de l'absence de test sur l'**artefact**. Cf. plan ci-dessous.

## Plan de durcissement (tests à ajouter)

Tous implémentés. T1 aurait attrapé l'incident directement.

- **T1 — Garde anti-dérive (`ci.yml`, job `quality`).** Après `db:generate`,
  `git diff --exit-code` sur `packages/echoppe-core/drizzle/` doit être propre → échoue si
  `schéma ≠ migrations committées`. La CI n'utilise jamais `db:push`.
- **T2 — Smoke « base vierge depuis l'image » (`apps/echoppe-api/scripts/integration.ts`).**
  Postgres jetable → image `api` buildée (migrate au boot) → seed démo (produit `color`)
  → assert `/products/` `200` (images/swatches non vides), `/products/by-slug/{slug}`
  `200` avec `options[].type` / `values[].metadata`, `/countries/` `200` non vide.
- **T3 — Chemin upgrade (même orchestrateur).** La base n-1 est créée par l'**image
  publiée précédente** (`PREV_IMAGE`, défaut `:latest` → migrations 0000-N + journal
  réel), puis la nouvelle image applique les migrations forward au boot → on rejoue T2.
  Pas de fixture SQL à maintenir. Empêche « marche en fresh, casse en upgrade ».
- **T4 — Parité contrat (même orchestrateur).** SDK régénéré depuis l'OpenAPI de
  l'image → `git diff` sur les fichiers de **types** (`src/openapi.ts`/`models.ts`/
  `facade.ts`). On ne gate pas `openapi.json` : l'émission de `additionalProperties`
  par TypeBox y varie de façon cosmétique (types identiques) → faux positifs sinon.
- **T5 — Idempotence seeds (même orchestrateur).** Re-boot de l'image (migrate rejoué)
  → healthy + `country` toujours à 1 France (upsert idempotent).

**Branchement.** T1 dans `ci.yml` (push/PR) + smoke source-level (`test:smoke`). T2–T5
dans `docker-build.yml`, job `integration` **dont dépend `build-and-push`** (`needs`) :
aucune image ne part sur le registre si le gate échoue. Local : `bun run --cwd apps/echoppe-api
test:integration` (auto-provisionne tout, `INTEGRATION_IMAGE` pour réutiliser un build).

**Garde contrat (ajoutée 2026-07-19).** Miroir de T1 pour le SDK : `bun run contracts:check`
(`ci.yml`) régénère le client depuis l'app pure offline et échoue si les types figés
(`openapi.ts`/`models.ts`/`facade.ts`) divergent des routes → attrape « route changée, SDK
oublié » dès la PR, pas seulement au gate T4.

**Release one-move (2026-07-19).** `docker-build.yml` est **réutilisable** (`workflow_call`) :
`release.yml` l'appelle après le publish npm (merge de la PR « Version Packages ») avec la version
publiée → npm + images en un seul acte humain (le merge), à la même version, gate T2–T5 inclus. Le
trigger `push: tags v*` subsiste comme échappatoire manuelle.

## Garde-fous environnement

- **Ne jamais** migrer/seed une base de prod. Conteneurs `dpc-*` = boutique réelle.
  Framework = `echoppe-*` (via `compose.dev.yaml` / `compose.yaml`) ou éphémère jetable.
- `echoppe-db` et `dpc-db` partagent le port 5432 → ne pas lancer le stack framework
  pendant que dpc tourne ; préférer un conteneur jetable sur un port libre.
