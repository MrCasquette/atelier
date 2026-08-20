# Architecture d'`atelier` — vue d'ensemble

**Ce document décrit l'état courant du dépôt.** Il ne justifie rien : chaque affirmation renvoie à
l'ADR qui l'a tranchée. Il se remplace quand la structure change, il ne s'amende pas
([ADR-0060](../adr/ADR-0060-natures-de-la-documentation.md)).

Le détail des routes n'est pas ici : la SSOT est l'**OpenAPI**, servie sur `/-/docs` de l'API et
dérivée en référence SDK dans `docs/sdk/`. Une liste tenue à la main dériverait.

## Deux produits, un workspace

`atelier` n'est pas un produit. Il héberge deux produits qui ne dépendent jamais l'un de l'autre :

| Produit | Ce que c'est |
|---|---|
| **Prisme** | CMS headless config-as-code |
| **Échoppe** | framework e-commerce |

Ils sont frères en dépendance et en priorité, **inégaux en recomposition** : Échoppe recompose les
mêmes paquets de contenu que Prisme, plus ceux du commerce. Échoppe n'empaquette pas Prisme pour
autant — aucun des deux n'est traversé par l'autre.
→ [ADR-0058](../adr/ADR-0058-fraternite-des-produits.md), [ADR-0025](../adr/ADR-0025-deux-produits-un-repo.md).

**Conséquence de placement** : une capacité qui ne parle que de contenu appartient aux paquets
partagés ; une capacité qui parle de commerce appartient à `echoppe-core`. Le critère est le
vocabulaire du code, jamais son lieu de naissance — le dépôt a été écrit dans l'ordre
`Échoppe → Prisme`, l'inverse de l'ordre logique.

## Les applications

| Application | Techno | Rôle | Distribution |
|---|---|---|---|
| `apps/echoppe-api` | Elysia (Bun) | API REST + OpenAPI, auth, RBAC, paiement, migrations au boot | image Docker |
| `apps/echoppe-admin` | Vue 3 | dashboard, servi en statique par l'API sous `/-/admin` | dans l'image de l'API |
| `apps/echoppe-store` | Astro + îlots Vue | storefront d'exemple, consommateur du SDK | non distribué |
| `apps/prisme-api` | Elysia (Bun) | API du CMS | image Docker |
| `apps/prisme-admin` | Vue 3 | dashboard du CMS | dans l'image de l'API |

Le dashboard n'a pas d'image propre : une seule image runtime par produit, les surfaces
d'exploitation sous l'espace réservé `/-/`.
→ [ADR-0052](../adr/ADR-0052-surfaces-exploitation-image-unique.md).

## Les paquets, en trois familles

> Cette liste est **dérivable du dépôt et n'est pas encore gardée** : c'est le premier candidat à une
> garde de dérive documentaire.

**Les cœurs produit** — `echoppe-core`, et `prisme-core` quand `prisme-api` le justifiera. Un cœur
possède sa connexion, son manifeste de schémas, sa `drizzle.config.ts` et ses migrations. **Un
produit = un cœur = une base.** Un paquet partagé ne porte jamais de migrations : le cœur les emprunte.
→ [ADR-0025](../adr/ADR-0025-deux-produits-un-repo.md), [ADR-0033](../adr/ADR-0033-organisation-monorepo.md).

**Les paquets partagés**, scope `@repo/*`, jamais publiés :

| Paquet | Ce qu'il porte |
|---|---|
| `db` | la connexion et le vocabulaire de requête — sous tout le monde, ne dépend de personne |
| `shared` | utilitaires transverses |
| `auth` | sessions, principaux, RBAC |
| `identity` | identité du site et entité légale |
| `fields` | la grammaire des champs — partagée par les pages et les entités |
| `pages` | pages, sections, et le registre qui décrit comment une section est faite |
| `entities` | déclaration → table réelle, comparaison au schéma, application |
| `menus` | navigation — un menu pointe, il ne contient pas |
| `references` | le registre des cibles référençables |
| `assets` | média |
| `communication` | envoi de messages, adapters et journal |
| `adapters` | la mécanique générique : registre de providers et port de credentials |

**Les paquets publiés** — `@echoppe/client` (SDK figé sur l'OpenAPI), `@mrcasquette/content` (le DSL
de déclaration, agnostique du commerce, d'où le namespace neutre), `create-echoppe` et
`create-prisme` (scaffolding d'un consommateur).

## Les frontières, et ce qui les tient

L'architecture de ce dépôt tient moins à sa disposition qu'à ce qui **refuse** de la voir dériver.
Sept gardes plus la vérification du contrat, chacune lancée par `bun run <nom>` :

| Garde | Ce qu'elle refuse |
|---|---|
| `product-isolation` | qu'un produit dépende de l'autre — déclaré **ou seulement importé** |
| `core-passthrough` | qu'un cœur réexporte la surface d'un paquet partagé |
| `drift-guard` | qu'un schéma dérive de ses migrations |
| `reserved-space` | qu'une route empiète sur l'espace réservé |
| `image-manifests` | qu'une image publiée mente sur son contenu |
| `release-coverage` | qu'une surface publiée change sans changeset |
| `registry-gap` | qu'un registre npm manque à la publication |
| `contracts:check` | que le SDK diverge du contrat de l'API |

**Leur invariant : une garde découvre, elle n'énumère pas.** Elle ne contient jamais la liste des
paquets ou des produits qu'elle traite — elle la reconstitue à chaque exécution, par capacité (un
fichier qui prouve qu'un workspace sait faire quelque chose) ou par déclaration.
→ [conventions § L'outillage découvre](../conventions.md#loutillage-découvre-il-nénumère-pas).

## Les deux contrats

- **Interne** — le dashboard consomme l'API par **Eden Treaty**, sur les types réels. Couplage fort
  assumé : les deux sont co-versionnés dans la même image.
- **Externe** — une boutique consomme un **SDK généré depuis l'OpenAPI**, figé, limité à la surface
  publique.

La SSOT du contrat, ce sont les schémas **TypeBox** ; les projections publiques filtrent ce qui a le
droit de sortir. → [ADR-0007](../adr/ADR-0007-contrat-sdk.md),
[ADR-0015](../adr/ADR-0015-validation-typebox.md), [ADR-0006](../adr/ADR-0006-visibilite-catalogue.md).

## Runtime et distribution

- Runtime **Bun**, jamais Node ni npm. Le `.env` racine n'est pas hérité : Bun ne lit que le cwd,
  donc tout script de sous-paquet passe par `--env-file=../../.env`.
  → [ADR-0003](../adr/ADR-0003-runtime-pm.md).
- L'API **migre au boot** en production (`RUN_MIGRATIONS`) ; le développement pousse le schéma.
  → [ADR-0004](../adr/ADR-0004-migrations-release.md).
- Deux canaux : images Docker pour le runtime, npm pour le SDK et les CLI. La boutique réelle vit
  **hors** du dépôt — elle en est le consommateur, pas un morceau.
  → [ADR-0002](../adr/ADR-0002-distribution.md), détail dans [distribution.md](./distribution.md).
- Un port publié appartient à l'**instance**, pas au produit. → [ports.md](./ports.md),
  [ADR-0054](../adr/ADR-0054-ports-rang-de-pile.md).

## Où continuer

| Question | Page |
|---|---|
| Comment le contenu est déclaré, validé, stocké | [contenu.md](./contenu.md) |
| Comment une entité devient une vraie table | [entites.md](./entites.md) |
| Comment une machine s'authentifie | [cles-api.md](./cles-api.md) |
| Comment les variables sont interpolées | [interpolation.md](./interpolation.md) |
| Comment on écrit du code ici | [conventions.md](../conventions.md) |
| Ce que les mots veulent dire | [glossaire.md](../glossaire.md) |
| Pourquoi tout ceci | [les ADR](../adr/README.md) |
