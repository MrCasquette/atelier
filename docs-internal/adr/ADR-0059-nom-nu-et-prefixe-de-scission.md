# ADR-0059 — Un paquet garde son nom, sa scission se qualifie

Statut : accepté · 2026-08-20
Portée : socle

Précise [ADR-0033](./ADR-0033-organisation-monorepo.md) — qui pose la disposition à plat et les
paquets partagés — en lui ajoutant ce qu'elle ne dit pas : **comment un paquet se nomme quand il se
coupe en deux.**

## Contexte

`@repo/pages` porte trois natures dans un seul paquet :

1. le **vocabulaire** du registre — `definition-model.ts`, ce qu'est une section, de quoi elle est
   faite ;
2. la **logique** qui en dérive des verdicts — traduction champ → schéma, compilation TypeBox,
   `registryIssues`, `unknownRefTargets` ;
3. le **stockage** — les tables `page`, `section`, `content_definition`, le cache, `syncRegistry`,
   `page-service`.

Les deux premières n'interrogent rien. Elles sont pourtant soudées à la connexion par le graphe
d'imports : `definition-service.ts` fait `import { db } from '@repo/db'` au niveau module, et
`@repo/db` **lève à l'import** quand `DATABASE_URL` manque.

Le fichier de test le dit lui-même, et s'en excuse sur sept lignes :

```ts
process.env.DATABASE_URL ??= 'postgres://unused@localhost:5432/unused';
const { registryIssues, unknownRefTargets } = await import('./definition-service');
```

Pour éprouver deux fonctions qui ne touchent aucune base, il faut mentir sur une URL et différer
l'import. Conséquence directe : `compileSections` et `definitionToSchema` — la traduction d'un champ
déclaré en validateur exécutable, c'est-à-dire le cœur du paquet — ne sont couvertes par **rien**,
puisqu'elles vivent derrière la lecture en base.

### Le paquet est au bon endroit, son contenu ne l'est pas

[ADR-0058](./ADR-0058-fraternite-des-produits.md) tranche le placement sans discussion : ce code ne
nomme que des pages, des sections et des champs, donc il est partagé. `@repo/pages` n'est pas « un
paquet d'Échoppe que Prisme voudra peut-être » — c'est du contenu, écrit avant Prisme et rangé au
bon endroit depuis. Ce qui ne l'est pas, c'est le **mélange interne**.

Et pour un CMS config-as-code, ce mélange est un contresens : le service le déclare noir sur blanc —
*« La source d'autorité, ce sont les fichiers du dev ; la base n'en est que le miroir. »* Le registre
**précède** son stockage. Ici il en dépend.

## Décision

### 1. La scission

Deux paquets, tous deux du socle, tous deux consommés par les deux produits :

| Paquet | Contenu | Dépendances |
|---|---|---|
| `@repo/pages-registry` | `definition-model.ts`, traduction champ → schéma, compilation, `registryIssues`, `unknownRefTargets`, traductions lignes ↔ registre, verdict de validation | `@repo/fields`, `@repo/shared`, `elysia` — **jamais `@repo/db`** |
| `@repo/pages` | tables `page`/`section`/`content_definition`, cache, chargement, `syncRegistry`, `page-service`, `reference` | `@repo/pages-registry`, `@repo/db`, `@repo/references` |

L'absence de `@repo/db` dans le manifeste de `pages-registry` n'est pas une consigne : c'est ce qui
rend l'import **irrésolvable**. Même idiome que le manifeste de migration tenu hors des `exports`
d'`@echoppe/core` — rendre inatteignable plutôt qu'interdire.

### 2. La règle de nommage, valable pour toute scission

**Le nom nu reste à ce que le mot désigne encore ; la partie extraite se qualifie d'un préfixe.**

Trois conditions, toutes nécessaires :

- **Le préfixe naît d'une scission, jamais d'une taxonomie.** Il nomme deux moitiés d'une même chose
  et a donc un référent. Il ne sert pas à ranger a priori des paquets voisins.
- **Le préfixe reprend le nom du concept scindé, au pluriel** — `pages-registry`, pas
  `page-registry`. Tous les paquets de concept du dépôt sont au pluriel (`fields`, `entities`,
  `menus`, `references`, `adapters`, `assets`) ; un singulier serait une exception sans règle.
- **On ne préfixe que ce qui en a besoin.** Un nom autosuffisant ne se qualifie pas. « Registry » ne
  dit pas de quoi il est le registre ; « pages » se suffit.

L'asymétrie qui en résulte est voulue. Elle n'encode aucun rapport de force — dans le graphe,
`pages-registry` est **en dessous**, c'est `pages` qui l'importe. Elle encode seulement qu'un des
deux mots parle seul et l'autre non.

Cette règle vaut pour les scissions à venir comme pour celles qu'on aurait dû faire et qui restent à
rattraper.

## Ce qui a été écarté

**Un arbre de dossiers** (`packages/pages/registry`, `packages/pages/storage`). Techniquement
possible — Bun accepte `packages/**` —, mais **npm n'a qu'un seul niveau de scope** : le nom du
paquet reste `@repo/pages-registry` de toute façon. L'arbre ne ferait que redire ce que le nom porte
déjà, contre un coût réel : le glob de `workspaces`, `contract-targets.ts`
(`{packages,apps}/*/package.json`), les `COPY packages/*/package.json` des Dockerfiles,
`image-manifests`. Et un `ls` trié alphabétiquement rend le groupement gratuitement.

**Un préfixe de domaine** (`content-pages`, `content-entities`, `content-menus`). Deux raisons : le
mot est déjà pris par `@mrcasquette/content`, le paquet **publié** de déclaration côté dev — et ce
que ces paquets partagent réellement est déjà extrait, c'est `@repo/fields`. Une dépendance commune
dit la parenté mieux qu'un préfixe.

**`pages-repository`.** Le scope `@repo` *est* l'abréviation de repository, et dans un monorepo le
mot désignera toujours d'abord le dépôt git. Il promettrait par-dessus le marché une abstraction du
pattern homonyme — interface, implémentations interchangeables — que le paquet n'a pas et n'a aucune
raison d'avoir (philosophie §4).

**`pages-runtime`.** Trompeur : `pages-registry` fait le plus gros travail *à l'exécution* — c'est
lui qui compile les schémas et valide chaque écriture de section. Le distinguo réel n'est pas quand
le code tourne, c'est **s'il touche la base**.

**`pages-storage`, pour la symétrie.** Le paquet ne fait pas que stocker : `syncRegistry` refuse un
registre incohérent avant d'écrire. Et `import { findPage } from '@repo/pages-storage'` ajoute un mot
qui n'aide personne.

**Descendre le stockage dans les cœurs produit.** Cohérent avec « les migrations appartiennent aux
cœurs », mais le même service serait dupliqué dans `echoppe-core` et `prisme-core` — pour du socle
partagé, c'est un contresens.

## Conséquences

- Un seul paquet est renommé : un seul jeu d'imports à réécrire.
- La logique pure devient testable sans base, et `compileSections` / `definitionToSchema` sortent de
  leur angle mort de couverture.
- Le contournement en tête de `definition-service.test.ts` disparaît, son commentaire d'excuse avec.
- Un registre se valide hors base — au build, sur un fichier de config — sans tirer les tables d'un
  page-builder.

## Critère de réouverture

**Une seconde scission de `@repo/pages`.** Si le miroir en base du registre s'en détachait à son
tour, `pages` cesserait d'être autosuffisant et devrait se qualifier comme les autres. Un renommage
se paie une fois, quand il est justifié — pas par anticipation d'une scission hypothétique.
