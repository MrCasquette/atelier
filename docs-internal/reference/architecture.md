# Architecture Échoppe — vue d'ensemble

Point d'entrée pour comprendre le système. Les **décisions** sont dans les
[ADR](../adr/README.md) ; les **conventions de code** dans [PATTERNS.md](./PATTERNS.md) ; le détail
des routes = l'**OpenAPI** (SSOT, Scalar sur `/docs` de l'API + référence SDK générée `docs/sdk/`) —
jamais une liste maintenue à la main (elle dérive).

## Nature du produit

Framework e-commerce clé en main « à la Medusa » : un **backend déployable** (API + Admin, images
Docker) + un **front agnostique** que le dev construit par-dessus via l'API + une **CLI** de
scaffolding. La boutique réelle vit **hors** du monorepo (consommateur, pas morceau du framework).
→ [ADR-0002](../adr/ADR-0002-distribution.md).

## Couches

| Couche | Techno | Rôle | Distribution |
|--------|--------|------|--------------|
| `apps/api` | Elysia (Bun) | API REST + OpenAPI, auth, RBAC, paiement, migrations au boot | image Docker |
| `apps/admin` | Vue 3 | Dashboard admin (Eden Treaty, co-versionné) | image Docker |
| `apps/store` | Astro + îlots Vue | **Exemple** storefront dogfooding le SDK | non distribué |
| `packages/core` | Drizzle | Schéma DB (SSOT), migrations, adapters | interne |
| `packages/client` | openapi-typescript/fetch | **SDK** storefront figé sur `openapi.json` | npm |
| `packages/create-echoppe` | @clack/prompts | CLI de scaffolding boutique | npm |
| `packages/shared` | — | utilitaires transverses | interne |

## Contrats (deux surfaces)

- **Interne (admin)** : **Eden Treaty** sur les types de l'API, couplage fort assumé (monorepo).
- **Externe (storefront)** : **SDK OpenAPI** figé, généré depuis `/docs/json`, surface **publique
  uniquement**. → [ADR-0007](../adr/ADR-0007-contrat-sdk.md).

La SSOT du contrat = les schémas **TypeBox** (`apps/api/src/models/*`). Les projections publiques
(`variantPublicSchema`, `productDetailSchema`…) filtrent ce qui fuit vers le SDK.
→ [ADR-0006](../adr/ADR-0006-visibilite-catalogue.md).

## Runtime & déploiement

- Runtime API = **Bun** (binaire compilé), front = **Node** ; PM **agnostique** (lockfile canonique
  `bun.lock`). → [ADR-0003](../adr/ADR-0003-runtime-pm.md).
- L'API **migre au boot** (`RUN_MIGRATIONS`) ; dev = `db:push`, prod = migrations drizzle versionnées.
  Validation release en deux temps (sources → artefact). → [ADR-0004](../adr/ADR-0004-migrations-release.md).
- ⚠️ **Ops** : ne jamais toucher les conteneurs `dpc-*` (prod boutique réelle). Tests = base jetable
  éphémère sur port libre, jamais 5432 partagé.

## Flux transverses

- **Auth** : sessions **Postgres** + cookie HTTP-only, pas de JWT ; RBAC `resource:action` +
  `adminOnly`. → [ADR-0008](../adr/ADR-0008-auth-sessions.md).
- **Panier & paiement** : panier serveur, checkout Stripe hosted, **capture manuelle + garde stock
  atomique Postgres** (pièces uniques), idempotence webhook. → [ADR-0005](../adr/ADR-0005-panier-stock.md).
- **Storefront front** : Astro hybrid, îlots Vue, topologie B (BFF + server islands).
  → [ADR-0001](../adr/ADR-0001-stack-storefront.md).

## Sous-systèmes transverses

- **Providers externes** : adapters par famille (paiement/livraison/communication), config-driven,
  secrets chiffrés au repos. → [ADR-0011](../adr/ADR-0011-adapters-providers.md).
- **Contenu / page-builder** : `@mrcasquette/content`, blocs déclarés par le dev, validateur générique,
  typage par inférence. → [ADR-0012](../adr/ADR-0012-module-contenu.md).
- **RBAC** : rôles/permissions administrables, rôles système, owner bypass, cache.
  → [ADR-0013](../adr/ADR-0013-modele-rbac.md) · **Clés d'API machine** →
  [ADR-0014](../adr/ADR-0014-cles-api-machine.md).
- **Validation** : TypeBox/Elysia à la frontière, `models/*.ts` = SSOT du contrat (pas Zod).
  → [ADR-0015](../adr/ADR-0015-validation-typebox.md).
- **Documents** : factures/reçus via Typst + numérotation. →
  [ADR-0017](../adr/ADR-0017-documents-typst.md) · **Média** : disque local + dossiers →
  [ADR-0018](../adr/ADR-0018-stockage-media.md).

## Conventions de code

Conventions projet (seuils, structure `core`, pattern d'erreurs, tests) →
[conventions.md](./conventions.md). Conventions front admin détaillées → [PATTERNS.md](./PATTERNS.md) :
atomic design (`atoms/molecules/organisms`), **imports directs** des composants Vue (pas de barrel),
types **inférés depuis Eden** (jamais d'interface manuelle pour les données API), validation à la
**frontière unique**. Piège à connaître : **Eden réserve les verbes HTTP** comme noms de segment
(cf. ADR-0007).
