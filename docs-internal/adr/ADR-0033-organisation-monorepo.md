# ADR-0033 — Organisation du monorepo : disposition à plat, deux cores, packages partagés

Statut : accepté · 2026-08-02
Portée : socle

## Contexte

[ADR-0025](./ADR-0025-deux-produits-un-repo.md) pose la frontière — le core appartient au produit et
possède la base, un package partagé livre des définitions de tables, la flèche de dépendance va du
produit vers le package. Il reste à en tirer la **disposition concrète** : où vivent les
applications, comment se nomment les packages, et ce que fabriquent les CLI.

État actuel : `apps/{api,admin,store}`, `packages/{core,client,content,create-echoppe,shared}`, un
seul `core` qui porte la base, les schémas, les adapters et les services.

## Options envisagées

- **Imbriqué par produit** — `apps/echoppe/{api,admin}`, `apps/prisme/{api,admin}`. Lisible, mais
  crée un niveau de plus et complique les filtres Bun (`-F`) comme les chemins CI.
- **À plat, préfixé par produit** — `apps/echoppe-api`, `apps/prisme-api`.

## Décision

### Disposition à plat, préfixée par produit

```
apps/
  echoppe-api  echoppe-admin  echoppe-store
  prisme-api   prisme-admin                     (V1 — cf. amendement du 2026-08-10)
  prisme-store                                  (V2, cf. ADR-0029)
packages/
  echoppe-core  prisme-core
  echoppe-client  prisme-client
  auth  content  assets  communication  adapters  identity  shared
  create-echoppe  create-prisme
```

### Deux cores

Conséquence directe d'ADR-0025 : `echoppe-core` et `prisme-core`. Chacun porte **sa** connexion, son
barrel de schémas, sa `drizzle.config.ts` et son dossier de migrations. Un produit = un core = une
base.

### Nommage

- **Packages internes** : scope `@repo/*`. Jamais publiés.
- **Packages publiés** : le scope suit le produit — `@echoppe/client` reste. Un artefact agnostique
  prend un namespace neutre : `@mrcasquette/content` (cf. amendement d'[ADR-0012](./ADR-0012-module-contenu.md)).

### Découpage des adapters

`packages/core/src/adapters/` est scindé en trois selon qui en a besoin :

| Cible | Contenu | Pour |
|---|---|---|
| `@repo/adapters` | `registry.ts`, `credential-store.ts` — l'abstraction et le port DIP | les deux |
| `@repo/communication` | `adapters/communication/*` + `schema/communication.ts` | les deux — Prisme envoie des emails |
| `echoppe-core` | `adapters/payment/*`, `adapters/shipping/*` | commerce seul |

**Prérequis** : `services/email.ts` expose aujourd'hui `sendOrderConfirmation` et
`sendShipmentNotification`, et `adapters/communication/templates.ts` code en dur les templates
`order-confirmation` et `shipment`. L'adapter est propre, la couche au-dessus ne l'est pas. Il faut
un `sendEmail(template, data)` générique dont les templates sont **enregistrés par le produit**,
sinon Prisme hérite du vocabulaire des commandes.

### Les deux CLI ont le même rôle

`create-echoppe` et `create-prisme` scaffoldent un **consommateur** : un `compose.yaml` qui tire les
images, un `.env` pré-rempli, et la configuration. Les packages arrivent en dépendances npm. C'est le
modèle d'[ADR-0002](./ADR-0002-distribution.md), il s'applique inchangé aux deux produits.

### Pas de modules désactivables

Aucun mécanisme d'activation/désactivation de briques fonctionnelles à l'échelle du produit. Un
produit assemble ce dont il a besoin à la compilation. (À ne pas confondre avec l'activation des
**entités**, qui est un mécanisme de contenu — cf. [ADR-0028](./ADR-0028-activation-entites.md).)

## Conséquences

- Les alias TypeScript de `tsconfig.base.json` ne pointent aujourd'hui que vers des packages, jamais
  vers des apps : **renommer les apps ne touche pas les chemins TS**. La migration des apps est un
  `git mv` plus les scripts racine.
- Les chaînes de scripts en `--cwd` de la racine sont à reprendre — le passage au filtre Bun (`-F`)
  déjà fait pour `type-check` sert de modèle.
- `packages/core/src/db/schema/enums.ts` reste le blocage mécanique n°1 : un sac global de ~20
  `pgEnum` mélangeant tous les domaines. À découper avant toute extraction.
- Le SQL d'une table partagée figure dans les deux historiques de migrations. Correct : deux bases.

## Question ouverte

**Le scope npm du SDK Prisme.** `@echoppe/client` reste tel quel ; l'équivalent Prisme dépend de la
disponibilité du scope sur npm, à vérifier au moment de la publication.

## Amendement 2026-08-10 — Prisme n'est pas en V2, seul son front livré l'est

L'arborescence de la décision porte `prisme-api prisme-admin prisme-store (V2, cf. ADR-0029)`. Le
marqueur est faux pour deux des trois, et il contredit
[`roadmap-prisme.md`](../design/roadmap-prisme.md), qui place « Prisme headless, dev only » en **V1**
avec ses prérequis d'infrastructure — dont cet ADR lui-même.

L'erreur est une confusion de portée. [ADR-0029](./ADR-0029-rendu-generique.md) traite du **rendu
générique** : l'utilisateur active une entité et la voit en ligne sans thème et sans dev. C'est ça
qui est en V2, et ça ne concerne qu'un front livré.

Or en V1 le dev écrit son front, exactement comme pour Échoppe. Prisme V1 n'a donc **pas besoin de
`prisme-store`** — et a besoin de `prisme-api` et `prisme-admin`, sans quoi il n'existe pas.

```
apps/
  echoppe-api  echoppe-admin  echoppe-store
  prisme-api   prisme-admin                    (V1)
  prisme-store                                 (V2, cf. ADR-0029)
```

**Prisme est une cible prioritaire.** Ce que ça change concrètement :

- `prisme-core` cesse d'être hypothétique. Il n'a toujours pas à naître avant son consommateur — un
  cœur porte une `drizzle.config.ts` et un dossier de migrations, qui dérivent aussitôt s'ils ne
  migrent rien —, mais ce consommateur est le prochain chantier, pas un lointain.
- Le dernier couplage du socle, `RESOURCES` dans `echoppe-core/src/constants/resources.ts`, devient
  bloquant plutôt que gênant : une API Prisme qui monte `@repo/auth` hériterait du vocabulaire
  e-commerce dans son RBAC (cf. #26).
- Ce qui manque à Prisme n'est plus du découplage mais de la fonctionnalité : les **entités**
  ([ADR-0027](./ADR-0027-entites-tables-reelles.md), #27), sans lesquelles Prisme n'est qu'un
  constructeur de pages.

## Amendement 2026-08-10 — deux écarts de nommage, acquis à l'extraction

L'arborescence liste `auth content assets communication adapters identity shared`. L'extraction (#11)
en a livré deux de plus et rebaptisé un.

**`content` s'appelle `pages`.** Le nom `content` était déjà pris — par
`@mrcasquette/content`, le DSL de déclaration, publié et renommé peu avant. Le nom de l'ensemble
s'étant trouvé dépensé sur une de ses moitiés, l'autre prend un nom qui dit ce qu'elle contient :
`page`, `section`, et le registre qui décrit comment une section est faite.

**`menus` est un paquet à part.** Un menu n'est pas une page : il POINTE vers des choses, dont des
pages. Le mettre dans `@repo/pages` aurait donné un nom qui ne couvre pas son contenu.

**`references` est né avec [ADR-0032](./ADR-0032-cibles-referencables.md)** — le registre de cibles
référençables, dont `pages` et `menus` dépendent tous deux. Ce n'est pas une abstraction par
anticipation : il avait deux consommateurs le jour de sa création.

État réel de `packages/` après #11 :

```
packages/
  echoppe-core                                  (prisme-core naîtra avec prisme-api)
  client                                        (= @echoppe/client)
  adapters  assets  auth  communication  db  identity  menus  pages  references  shared
  content                                       (= @mrcasquette/content, le DSL publié)
  create-echoppe
```
