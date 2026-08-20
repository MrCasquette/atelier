# Glossaire — vocabulaire et grammaire d'`atelier`

Ce document **ferme des mots**. Il porte deux choses : la grammaire du dépôt (ce que veut dire un
scope, un cœur, une garde) et le vocabulaire métier (ce qu'est une section, une entité, un principal).

Ce n'est pas un ornement. Un mot qui désigne deux choses coûte un aller-retour à chaque fois qu'on
l'emploie, et finit par produire une décision fausse. La partie « mots surchargés » ci-dessous existe
parce que chacun de ces mots a déjà coûté une discussion.
→ [ADR-0060](./adr/ADR-0060-natures-de-la-documentation.md).

## Grammaire du dépôt

| Terme | Désigne |
|---|---|
| **Workspace** | `atelier` lui-même — il héberge, il n'est pas un produit |
| **Produit** | Échoppe ou Prisme. Ils ne dépendent jamais l'un de l'autre |
| **Cœur** | le paquet qui possède la base d'un produit : connexion, manifeste de schémas, migrations. Un produit = un cœur = une base |
| **Paquet partagé** | scope `@repo/*`, jamais publié, recomposé par les deux produits |
| **Paquet publié** | ce qui sort sur npm — le scope suit le produit (`@echoppe/*`), sauf artefact agnostique qui prend un namespace neutre (`@mrcasquette/*`) |
| **Garde** | un script qui **refuse** une dérive au lieu de la documenter. Une garde découvre, elle n'énumère jamais |
| **Surface** | ce qui est exposé et versionné vers l'extérieur — une image, un paquet npm, un contrat |
| **Recomposition** | la manière dont un produit obtient une capacité : en prenant le paquet, jamais en traversant l'autre produit |

### Les mots surchargés

Ces mots ne s'emploient **jamais seuls** dans ce dépôt — chacun désigne au moins deux choses :

| Mot | Sens en présence |
|---|---|
| **registry** | les registres npm (`registry-gap`) · le registre des cibles référençables (ADR-0032) · le registre des définitions de contenu · le registre des principaux (ADR-0037) |
| **socle** | une portée d'ADR · l'ensemble des paquets partagés. **Jamais** un produit : Prisme n'est pas le socle d'Échoppe |
| **content** | `@mrcasquette/content`, le DSL publié · la famille de contenu (pages, entités, champs) |
| **store** | `apps/echoppe-store`, la vitrine · le mot anglais pour stocker — d'où son refus comme suffixe de paquet |
| **repository** | le dépôt git · le scope `@repo` · le pattern DDD. Inutilisable comme nom |

### Nommer un paquet

Le nom nu reste à ce que le mot désigne encore ; la partie extraite se qualifie d'un préfixe, **au
pluriel**, repris du concept scindé — `pages` et `pages-registry`. Le préfixe naît d'une scission,
jamais d'une taxonomie : on ne préfixe que ce dont le nom, seul, ne dit rien.
→ [ADR-0059](./adr/ADR-0059-nom-nu-et-prefixe-de-scission.md).

## Vocabulaire du contenu

> **Ratifié** par [ADR-0043](./adr/ADR-0043-lexique-contenu.md), qui ajoute `definition` (une
> entrée du registre) et `content` (la famille), et tranche que `menu` relève de la navigation, pas
> du contenu.

Le mot `type` était déjà pris en base (`section.type` = quel bloc est-ce) : le réemployer pour
désigner un modèle d'entité garantissait la collision. D'où ce lexique.

### Termes

| Terme | Désigne | Exemple | En base |
|---|---|---|---|
| **Primitive** | un type de champ | `text`, `richText`, `image`, `relation`, `i18n` | `field.kind` |
| **Champ** | une primitive nommée dans un schema | `titre: text()` | clé de `fields` |
| **Schema** | la liste de champs d'une section ou d'une entité | — | `content_definition.fields` |
| **Section** | une unité de présentation insérable dans une page | `Hero`, `FAQ`, `CTA` | `section.type` |
| **Component** | un groupe de champs réutilisable, non insérable seul | `Bouton` | `content_definition.role` |
| **Page** | un document composé de sections | `/a-propos` | table `page` |
| **Entité** | un modèle de données éditable | `Article`, `Événement` | une table par entité |
| **Definition** | une entrée du registre : un schema nommé, de rôle `section` ou `component` | `Hero`, `Bouton` | ligne de `content_definition` |
| **Registry** | l'ensemble des definitions, remplacé en un geste | — | table `content_definition` |

Une **instance** n'a pas besoin de mot dédié : c'est un `Hero`, c'est un `Article`.

### Choix de vocabulaire

- **Section** plutôt que « bloc » — reprend littéralement la sémantique HTML, là où « bloc » est
  générique. `section.type` se lit sans ambiguïté.
- **Entité** plutôt que « collection » (Directus) ou « content type » (Strapi) — vocabulaire Doctrine,
  sémantiquement plus juste, et « content type » retombe dans le mot piégé.
- **Schema** plutôt que « modèle » — vient de Zod ; « modèle » est chargé par le MVC.
- **Front** plutôt que « storefront » — dans tout ce qui est partagé. « Storefront » nomme la
  vitrine d'un commerce ; un CMS n'en a pas. Le mot avait survécu dans les commentaires de
  `@repo/pages`, `@repo/menus`, `@repo/references` et du DSL publié, où il désignait simplement
  l'application qui LIT le contenu.

  La frontière est celle des paquets : dans `apps/echoppe-*` et `echoppe-core`, « storefront » est
  exact et reste. Dans un paquet partagé, il ne l'est pas. Même règle pour « boutique », qui garde
  sa place quand il nomme précisément ce qui N'appartient PAS au socle — par exemple, dans
  `@repo/identity`, « des colonnes de boutique obligatoires, inutilisable pour un CMS ».

## Vocabulaire de l'autorité

| Terme | Désigne |
|---|---|
| **Principal** | qui agit — un administrateur, un client, une clé d'API. Le paquet `auth` en définit le contrat, chaque produit déclare les siens (ADR-0037) |
| **Surface** | où il agit : `admin` ou `public`. Union fermée, pas un registre |
| **Ressource** | ce sur quoi porte un droit. L'espace est ouvert : une entité déclarée donne `entity:<nom>` (ADR-0038) |
| **Authority** | ce qu'un principal détient : `total`, `except` (tout sauf), ou `granted` (ce qui lui est accordé). L'Administrateur est défini **par soustraction** (ADR-0047) |
| **Propriétaire** | un drapeau `isOwner`, pas un rôle |

## Ce que le glossaire ne recouvre pas encore

- Le nom de l'écran d'administration qui sépare la définition des entités de leur contenu (Directus
  distingue *Data Model* et *Content*). Non tranché — cf.
  [ADR-0028](./adr/ADR-0028-activation-entites.md).
