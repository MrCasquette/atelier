# ADR-0058 — Deux produits frères, des recompositions inégales

Statut : accepté · 2026-08-20
Portée : socle

Précise [ADR-0025](./ADR-0025-deux-produits-un-repo.md) — qui pose la frontière core / packages et
la flèche de dépendance — en énonçant ce qu'elle laisse implicite : **le rapport entre les périmètres
des deux produits**, et ce qu'il implique pour le placement d'une capacité.

## Contexte

Le dépôt a été écrit dans l'ordre `Échoppe → Prisme` : le framework e-commerce d'abord, le CMS
ensuite, versé dans le même monorepo puis séparé en paquets. L'ordre **logique** est l'inverse : un
CMS gère du contenu, un framework e-commerce gère du contenu **et** du commerce.

Rien ne l'écrit. ADR-0025 dit :

> Échoppe (framework e-commerce) et Prisme (CMS) ne sont **pas un système à découper en deux**. Ce
> sont **deux applications distinctes** […] Aucune ne nécessite l'autre.

et `AGENTS.md` dit « deux produits **frères** — aucun n'est le produit principal ». Les deux sont
exacts, et tous deux parlent de **dépendance**. Aucun ne dit ce qui se passe un cran plus bas : que
les deux produits recomposent les mêmes paquets de contenu, et qu'Échoppe en recompose davantage.

### Le principe était écrit, au mauvais endroit

Une fois, en passant. L'amendement du 2026-08-16 d'[ADR-0050](./ADR-0050-exception-jamais-reponse-http.md)
énonce déjà la thèse mot pour mot :

> **Aucune flèche entre produits.** Échoppe est conceptuellement Prisme plus le commerce, mais
> `echoppe-core` n'importe rien de `prisme-core` : les deux prennent le même socle.

Il l'écrit pour justifier autre chose — où fermer un vocabulaire de fautes — et le range donc sous
une décision qui parle d'exceptions et de réponses HTTP. Personne ne va y chercher le rapport entre
les produits, et rien n'en tire de règle de placement.

Ce n'est donc pas un principe neuf : c'est un principe **appliqué depuis longtemps et jamais
adressable**. Les ADR de contenu s'en servent déjà sans le nommer — [ADR-0036](./ADR-0036-cycle-de-vie-contenu.md)
justifie une décision par « Prisme est volontairement léger », [ADR-0037](./ADR-0037-principaux-surfaces.md)
constate que « `store` n'était pas un concept commerce : c'était le nom Échoppe de la surface
publique », [ADR-0047](./ADR-0047-autorite-principal.md) que « `customer` est du vocabulaire commerce
et ne part pas dans le socle ». Chacun redécouvre le critère pour son cas.

### Pourquoi cette dispersion coûte

La charge de la preuve s'en trouve inversée, sans que personne l'ait décidé. Le code étant né dans
Échoppe, tout y reste **jusqu'à ce qu'on démontre qu'il faut l'extraire** — alors que la question
correcte est de savoir si la capacité a jamais parlé de commerce.

L'historique le montre, ADR-0033 à l'appui :

- `@repo/pages` — le page-builder, c'est-à-dire du CMS pur — a vécu dans `echoppe-core` jusqu'à ce
  qu'on l'en sorte ;
- `@repo/fields` a dû être redressé après coup, ADR-0033 le qualifiant lui-même d'« héritage de
  l'ordre d'extraction, pas une intention » ;
- le même ADR doit poser en prérequis un `sendEmail` générique, faute de quoi « **Prisme hérite du
  vocabulaire des commandes** ».

Trois fois le même mouvement : extraire *a posteriori* ce qui n'aurait jamais dû être là.

Et le trou est réel aujourd'hui, à deux produits, sans rien supposer d'un troisième :
`product-isolation` refuse qu'un produit dépende de l'autre, mais **rien** n'empêche le vocabulaire
commerce de s'installer dans un paquet `@repo/*`.

## Décision

### 1. La nature de la fraternité

« Frères » est maintenu, et précisé. Les deux produits sont frères **en dépendance** — aucun
n'importe l'autre, `product-isolation` le garde — et **en priorité** : aucun n'est le produit
principal, aucun ne se subordonne à l'autre dans les arbitrages.

Ils sont **inégaux en recomposition** : Échoppe recompose les mêmes paquets de contenu que Prisme,
plus ceux du commerce.

Ce n'est donc pas une contradiction avec ADR-0025, c'est un autre niveau de lecture. Il n'y a aucune
inclusion produit → produit ; il y a une inclusion des **ensembles de paquets recomposés**.

### 2. Prisme n'est jamais traversé

Échoppe n'empaquette pas Prisme : il recompose les mêmes briques. Prisme n'est ni une couche, ni un
noyau, ni un intermédiaire — et surtout **pas un socle** : c'est un produit, au même rang qu'Échoppe,
qui consomme les paquets partagés comme lui.

Conséquence pratique : on ne dit jamais « cette capacité appartient à Prisme, donc Échoppe la prend
par lui ». On dit qu'elle appartient à un paquet partagé, que les deux recomposent.

### 3. Où va une capacité

> **Une capacité qui ne parle que de contenu appartient aux paquets partagés. Une capacité qui parle
> de commerce appartient à `echoppe-core`.**

Deux précisions, aussi contraignantes que la règle :

- **Le critère est le vocabulaire du code, pas son lieu de naissance.** Né dans Échoppe ne vaut pas
  commerce. Si le code ne nomme que des pages, des sections, des champs, des médias, des entités, il
  est partagé — même s'il n'a jamais servi qu'à une boutique.
- **La règle décide de la place d'une capacité déjà générique, jamais de rendre générique un besoin
  qui ne l'est pas.** Si le code parle de commandes, de paniers, de stock ou de paiement, il est du
  commerce, et on ne l'abstrait pas « au cas où » (philosophie §4). C'est la charge de la preuve qui
  change de côté, pas le seuil d'abstraction.

Prisme n'apparaît dans ce critère que comme **révélateur** : il rend visible qu'une capacité de
contenu n'a jamais été du commerce. Il n'en est pas le propriétaire.

## Ce qui a été écarté

**Dire que Prisme est le socle.** Le mot est déjà pris deux fois dans ce dépôt — la portée d'un ADR,
et les paquets `@repo/*`. Prisme n'est ni l'un ni l'autre, et lui donner ce nom rétablirait
exactement l'idée de couche traversée que §2 refuse.

**Justifier la règle par un troisième produit.** Aucun n'est prévu. La règle se tient à deux, sur un
manque constaté : le vocabulaire commerce peut fuir dans un paquet partagé sans que rien ne le
refuse.

**Amender ADR-0025.** Il n'est pas faux : il parle de dépendance, et ce qu'il en dit reste vrai mot
pour mot. Cet ADR le précise, il ne le corrige pas.

## Conséquences

- `AGENTS.md` précise la fraternité au lieu de l'affirmer seule.
- Le placement d'un paquet cesse de se rediscuter au cas par cas : le vocabulaire du code tranche.
  Les verdicts déjà rendus ne changent pas — cycle de vie du contenu, médias, SEO, i18n des champs
  sont du contenu ; paniers, commandes, paiements, stock sont du commerce — mais ils cessent d'être
  des débats.
- La scission de `@repo/pages` ([ADR-0059](./ADR-0059-nom-nu-et-prefixe-de-scission.md)) s'appuie sur
  cet ADR au lieu de reposer le contexte.
- Une garde reste à écrire : rien ne refuse aujourd'hui qu'un paquet `@repo/*` nomme une commande ou
  un panier. Le manque est identifié ici, sa forme reste à décider — le vocabulaire commerce se
  découvre mal par simple recherche de mots.

## Critère de réouverture

**Un troisième produit**, ou une capacité de contenu qu'Échoppe voudrait dans une forme
incompatible avec celle de Prisme. Le second cas est le vrai risque : il signifierait que la capacité
n'était pas générique, et se traite en la rendant paramétrable — jamais en la dupliquant dans les
deux cœurs.
