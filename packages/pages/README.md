# `@repo/pages` — les pages, leurs sections, et le miroir en base du registre

Ce que le paquet livre : **ce qui est stocké**. Les tables `page`, `section` et `content_definition`,
les accès qui les lisent et les écrivent, et le cache qui garde les validateurs compilés.

Ce qui se **calcule** à partir d'une définition vit dans `@repo/pages-registry`, qui n'a aucune base
([ADR-0059](../../docs-internal/adr/ADR-0059-nom-nu-et-prefixe-de-scission.md)).

## Frontière

**Aucune route, aucun plugin Elysia** — les schémas de requête et de réponse appartiennent au
produit, parce qu'ils *sont* le contrat
([ADR-0044](../../docs-internal/adr/ADR-0044-surface-http-paquets-partages.md)).

**Aucune réexportation.** Ni la grammaire de `@repo/fields`, ni la surface de `@repo/pages-registry` :
un consommateur qui a besoin d'un `Registry` ou d'un champ s'adresse au paquet qui le décrit. Sinon
la frontière n'existe plus que dans l'arborescence.

| Ici | Chez `@repo/pages-registry` |
|---|---|
| La table `content_definition` | Ce qu'est une définition (`model.ts`) |
| Le cache des validateurs compilés | Leur compilation |
| La décision de refuser une poussée, et la transaction qui remplace | Le diagnostic qui la motive |
| `validateSectionData` — aller chercher le registre | `checkSection` — rendre le verdict |

## Ce que le paquet porte

**Le registre stocké.** `syncRegistry` remplace le registre d'un bloc, après avoir constaté qu'il
tient debout et que ses cibles `ref` sont inscrites — jamais au milieu d'une écriture partielle. La
source d'autorité reste les fichiers du dev ; la table n'en est que le miroir.

**Les pages et leurs sections** (`page-service.ts`), et **la page comme cible référençable**
(`reference.ts`), parce que la table `page` vit ici. C'est une **fonction**, pas une inscription : un
paquet ne s'inscrit jamais tout seul, il n'a pas d'effet de bord à l'import, et c'est le produit qui
décide de ce que son registre contient.

## Un point d'implémentation

**Le registre stocké est revalidé au chargement.** Frontière interne assumée : le stockage est censé
être sain, mais on ne truste pas du `jsonb` non typé — et c'est cette vérification, pas une
affirmation, qui donne le type en retour.

## Tests

**Ce paquet n'a pas de test unitaire, et n'a pas de script `test`.** Tout ce qu'il porte interroge la
base ; ses tests sont donc des tests d'intégration et vivent dans `apps/echoppe-api/tests/`, avec le
Postgres qu'ils exigent. La logique éprouvable sans base est partie avec `@repo/pages-registry`.

## Dépendances

`@repo/db`, `@repo/pages-registry`, `@repo/references`, `drizzle-orm`, `elysia`.
