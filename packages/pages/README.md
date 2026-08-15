# `@repo/pages` — les pages, leurs sections, et le registre des définitions

Une `definition` est une entrée du registre : un schema nommé, de rôle `section` ou `component`,
déclaré par le dev via `@mrcasquette/content` et poussé en base par `PUT /content/registry`
([ADR-0043](../../docs-internal/adr/ADR-0043-lexique-contenu.md)).

## Frontière

**Aucune route, aucun plugin Elysia** — les schémas de requête et de réponse appartiennent au
produit, parce qu'ils *sont* le contrat
([ADR-0044](../../docs-internal/adr/ADR-0044-surface-http-paquets-partages.md)). Ce qui est ici
décrit ce qu'une donnée **est**.

La grammaire d'un champ vit dans `@repo/fields` et **n'est pas réexportée ici** : un consommateur qui
a besoin d'un champ s'adresse au paquet qui le décrit, sinon la frontière n'existe que dans
l'arborescence.

## Ce que le paquet porte

**Le validateur générique.** Le registre décrit la forme des blocs déclarés par le dev ; ce service en
dérive à l'exécution un validateur par type de section — chaque définition traduite en schéma
TypeBox, compilée une fois, mise en cache. C'est le pendant dynamique d'une union statique.

**La page comme cible référençable** (`reference.ts`), parce que la table `page` vit ici. C'est une
**fonction**, pas une inscription : un paquet ne s'inscrit jamais tout seul, il n'a pas d'effet de
bord à l'import, et c'est le produit qui décide de ce que son registre contient.

## Une dette structurelle à connaître

`definition-service.ts` importe `db` au niveau module, et **`@repo/db` lève à l'import** quand
`DATABASE_URL` manque. Conséquence : la logique **pure** de ce fichier — `assertRegistryCoherent`,
`unknownRefTargets` — est soudée à la connexion par le graphe d'imports, alors qu'elle n'interroge
rien. Ses tests doivent poser une `DATABASE_URL` factice.

`@repo/auth` a résolu le même problème en séparant les règles pures (`permission.ts`) de leur lecture
en base (`permission-cache.ts`). C'est la convention à appliquer ici quand ce module sera retouché.

## Deux points d'implémentation

**L'unicité des noms de champs est une garde explicite.** Elle était gratuite tant que `fields` était
un objet ; la séquence l'admet ([ADR-0049](../../docs-internal/adr/ADR-0049-schema-sequence-de-champs.md)),
donc `assertRegistryCoherent` la vérifie.

**Le registre stocké est revalidé au chargement.** Frontière interne assumée : le stockage est censé
être sain, mais on ne truste pas du `jsonb` non typé.

## Dépendances

`@repo/db`, `@repo/fields`, `@repo/references`, `drizzle-orm`, `elysia`.
