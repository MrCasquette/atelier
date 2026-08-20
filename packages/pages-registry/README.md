# `@repo/pages-registry` — le registre, sans son stockage

Ce que le paquet livre : **ce qu'est une définition de section, et tout ce qui se calcule à partir
d'elle**. La traduction en schéma TypeBox, la compilation d'un validateur par type de section, le
diagnostic d'incohérence, le verdict d'une donnée soumise.

Il ne stocke rien, et surtout : il ne **peut** rien stocker.

## L'invariant, et ce qui le tient

**`@repo/db` n'est pas dans son `package.json`** — l'import ne résout donc pas. Ce n'est pas une
consigne qu'on pourrait contourner par distraction, c'est une impossibilité
([ADR-0059](../../docs-internal/adr/ADR-0059-nom-nu-et-prefixe-de-scission.md)).

Le motif est celui d'un CMS config-as-code : **la source d'autorité, ce sont les fichiers du dev ; la
base n'en est que le miroir.** Un registre se valide donc avant d'être stocké — au build, sur un
fichier de configuration, dans un test — et rien de tout cela ne doit exiger un Postgres.

## Frontière

| Ici | Chez `@repo/pages` |
|---|---|
| Ce qu'est une définition (`model.ts`) | La table `content_definition` qui la range |
| La compilation d'un validateur par section | Le cache qui garde les validateurs compilés |
| Le diagnostic d'un registre : doublons, composants introuvables, cibles non inscrites | La décision de refuser la poussée, et la transaction qui remplace |
| Le verdict d'une donnée contre un validateur (`checkSection`) | D'aller chercher le registre pour l'obtenir (`validateSectionData`) |

La ligne est nette : **ce qui calcule est ici, ce qui interroge est là-bas.**

Les deux traductions `rowsToRegistry` / `registryToRows` sont ici malgré leur nom, et c'est
délibéré : elles ne lisent ni n'écrivent, elles convertissent. Elles décrivent d'ailleurs la forme
d'une ligne **structurellement** (`RegistryRow`) plutôt qu'en important une table — n'importe quel
stockage ayant ces colonnes leur convient.

## Ce que le paquet ne fait pas

- **Aucun accès base**, cf. ci-dessus. `bun test src` tourne sans `DATABASE_URL`.
- **Aucune route**, conformément à [ADR-0044](../../docs-internal/adr/ADR-0044-surface-http-paquets-partages.md).
- **Aucune connaissance des entités d'un produit.** `unknownRefTargets` reçoit `knownTargets` en
  argument et se contente de comparer des noms
  ([ADR-0032](../../docs-internal/adr/ADR-0032-cibles-referencables.md)).

## Deux points à connaître avant de modifier

**`rowsToRegistry` lève, et c'est voulu.** Un registre stocké invalide est une **corruption**, pas
une faute métier : il n'y a personne à qui rendre un verdict actionnable. Les fautes métier, elles,
sont des valeurs de retour — `registryIssues` rend une liste, `checkSection` une union discriminée
([ADR-0050](../../docs-internal/adr/ADR-0050-exception-jamais-reponse-http.md)).

**`registryIssues` ne compile rien pour diagnostiquer.** Détecter en tentant de compiler faisait
dépendre le diagnostic de ce qui se trouvait lever en premier, et coûtait une compilation jetée à
chaque poussée. Elle rend **toutes** les incohérences d'un coup : un dev corrige son registre une
fois, pas trois.

## Dépendances

`@repo/fields` pour la grammaire des champs, `@repo/shared` pour le vocabulaire de faute, et `elysia`
pour `t` et son type-system — la **même instance TypeBox** que le reste de l'API, donc aucune dérive
possible entre ce qui valide ici et ce qui valide sur une route.

## Histoire

Ce code vivait dans `@repo/pages`, mêlé au stockage. Son test devait poser une fausse `DATABASE_URL`
puis différer l'import pour éprouver deux fonctions qui n'interrogent rien — le module voisin
importait `db` au niveau module, et `@repo/db` lève à l'import sans variable.

Effet de bord découvert en séparant : `compileSections` et `definitionToSchema` — la traduction d'un
champ déclaré en validateur exécutable, c'est-à-dire le cœur du paquet — n'étaient couvertes par
**rien**, puisqu'elles vivaient derrière une lecture en base. Elles le sont depuis.

## Vocabulaire

`definition`, `section`, `component`, `registry` : voir le
[glossaire](../../docs-internal/glossaire.md), ratifié par
[ADR-0043](../../docs-internal/adr/ADR-0043-lexique-contenu.md).
