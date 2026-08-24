# ADR-0063 — Le scope dit qui publie, le nom dit à quoi le paquet appartient

Statut : accepté · 2026-08-24
Portée : socle

Complète [ADR-0062](./ADR-0062-scope-et-critere-de-publication.md) — dont le §3 tient, scope compris —
et **révise son §4**, le nom nu du SDK. Le critère de publication, la signification de `@repo/*`, les
initializers non scopés et l'obligation de métadonnées sont inchangés.

## Contexte

ADR-0062 a été acceptée le 22 août 2026 et n'a jamais été appliquée. Deux jours plus tard, au moment
de l'appliquer, deux gênes ont bloqué le chantier.

**Les noms des paquets partagés sonnent creux.** `@axiome-apps/content`, `@axiome-apps/prose` : rien
n'y dit de quel outillage ils viennent. Le fait qui l'explique n'était pas connu quand ADR-0062 a été
écrite — **Axiome publie majoritairement des applications desktop**. Le scope range donc le paquet
dans un catalogue où il n'a pas de voisins.

**Le nom nu du SDK ne dit plus le rôle.** Sous `@echoppe`, `client` était autosuffisant : le scope
disait le produit, le nom disait le rôle. En déplaçant le scope vers l'organisation, ADR-0062 §4 a
fait dire au nom le **produit** — `@axiome-apps/echoppe` nomme un framework entier, une image Docker,
une API, une administration. Rien n'y dit qu'on installe son client.

**Deux fausses pistes ont précédé la bonne**, et elles méritent d'être notées parce qu'elles
reviendront sinon.

La première a cherché un **nom commun plus précis** pour le paquet de déclaration : `definitions`,
`definition-dsl`, `schema-dsl`, `model-dsl`. Tous écartés sur preuve — les deux premiers sont faux
(`DefinitionRole` ne vaut que `section` et `component`, quand le paquet déclare aussi des entités et
bientôt des directives), les deux suivants collident lourdement et nomment le paquet d'après ce qu'il
produit. Le nom commun n'était pas le problème.

La seconde a voulu faire porter au **scope** le niveau manquant : un scope dédié, `@atelier`. Elle est
tombée sur le critère d'ADR-0062 §3 elle-même — *« le scope ne s'invente pas : il reprend une identité
vérifiable »*, la phrase qui avait déjà servi à écarter `@axiomejs`, `@axiome-dev` et `@getaxiome`. Un
scope `@atelier` aurait nommé **le rôle du dépôt à la place de son éditeur**, sans aucun chemin de
retour vers l'organisation. Le scope s'est d'ailleurs révélé indisponible, mais ce n'est pas ce qui
l'a écarté : il aurait été mauvais en étant libre.

Ce détour a servi à quelque chose. Il a fait apparaître le niveau qui manquait — et montré qu'il ne se
loge pas là où on avait d'abord voulu le mettre.

## Décision

### 1. Il y a trois niveaux, pas deux

| Niveau | Ce que c'est | Ici |
|---|---|---|
| **Organisation** | l'entité qui publie, proche d'une marque | Axiome |
| **Atelier** | le lieu où l'on fabrique les outils du web | `atelier` |
| **Produit** | ce qui en sort, et qui a ses propres utilisateurs | Échoppe, Prisme |

ADR-0062 n'en voyait que deux, et a fait porter au premier le travail du second. C'est la racine des
deux gênes du § Contexte.

**L'atelier n'est ni une marque ni un produit.** Il ne décrit pas la nature de ce qui en sort — il
décrit une **relation**, celle du lieu à sa production. C'est ce qui le sépare d'un nom de catégorie,
et ce qui lui permet d'accueillir un troisième produit sans devenir faux.

Le niveau existait déjà sans nom public : c'est ce que
[ADR-0058](./ADR-0058-fraternite-des-produits.md) désigne quand elle dit que les deux produits
recomposent les mêmes paquets sans se traverser.

### 2. Le scope dit qui publie — il ne dit pas la famille

Un scope npm est un **compte** : un propriétaire, une facturation, des membres, une double
authentification, des *trusted publishers*. Il répond à « qui publie », jamais à « de quelle famille
ça vient ».

**Le niveau du milieu n'est donc pas un éditeur, et n'a rien à faire dans le scope.** `@axiome-apps`
est maintenu, avec le critère d'ADR-0062 §3 intact : le scope reprend une identité vérifiable, celle
qui existe sur `github.com/Axiome-Apps`, et le développeur qui remonte du paquet retrouve
l'organisation.

### 3. Le nom dit l'appartenance, puis la matière ou le rôle

> **Le préfixe dit à quoi le paquet appartient — l'atelier, ou un produit. Ce qui suit dit ce qu'il
> est.**

```
@axiome-apps/atelier-content     appartient à l'atelier — déclarer
@axiome-apps/atelier-prose       appartient à l'atelier — rendre
@axiome-apps/echoppe-client      appartient à Échoppe   — son SDK
@axiome-apps/prisme-client       appartient à Prisme    — son SDK, à venir
create-echoppe                   initializer, non scopé
create-prisme                    initializer, non scopé
```

Un lecteur en déduit la règle sans qu'on la lui explique, et elle décalque les trois niveaux : le
scope dit l'organisation, le préfixe dit l'appartenance, le nom dit la matière ou le rôle.

**C'est ce qui clôt la question du nom commun**, celle qui avait résisté le plus longtemps. Un nom de
matière n'est jamais autosuffisant *seul* — il l'est **dans un contexte**. `atelier-content` et
`atelier-prose` ne sont plus opaques parce que le contexte leur est rendu. Chercher un nom commun plus
précis revenait à faire porter au nom une situation que rien ne portait.

Le pluriel et le singulier ne changent pas :
[ADR-0061](./ADR-0061-prose-directives-declarees.md) §10 continue de trancher — matière au singulier,
collection d'objets nommés au pluriel.

### 4. Le SDK est `echoppe-client`, pas `echoppe`

ADR-0062 §4 déduisait le nom nu de [ADR-0059](./ADR-0059-nom-nu-et-prefixe-de-scission.md). Elle en a
retenu la formule sans ses conditions, et ADR-0059 en pose trois, toutes nécessaires :

- **le préfixe naît d'une scission** — il n'y en a aucune ici, la règle ne s'appliquait donc pas ;
- **le préfixe reprend le nom du concept scindé** — sans objet, même raison ;
- **on ne préfixe que ce qui en a besoin** : *« Registry ne dit pas de quoi il est le registre ; pages
  se suffit. »*

C'est la troisième qui tranche, et elle tranche contre le nom nu : sous un scope qui nomme
l'organisation, `echoppe` est le cas « registry », pas le cas « pages ».

Le précédent invoqué — `stripe`, `algoliasearch`, `openai` — ne s'applique pas : chez eux le scope est
**absent**, donc le nom nu porte les trois niveaux à lui seul.

## Ce qui a été écarté

**Un scope dédié — `@atelier`, `@fabrique`, `@manufacture`, `@laboratoire`.** Trois raisons, dans
l'ordre de force :

1. **Il invente une identité**, ce qu'ADR-0062 §3 interdit explicitement et avait déjà servi à
   écarter trois candidats.
2. **Un scope est un éditeur, pas une famille.** Le dev qui lit `@atelier/prose` n'a aucun chemin de
   retour vers Axiome — le scope aurait nommé le rôle du dépôt à la place de son propriétaire.
3. **Le coût opérationnel est réel** : une seconde organisation à tenir, et les *trusted publishers*
   OIDC à recréer.

Deux notes de terrain, pour ne pas refaire les sondages : `@fonderie` est pris et vivant
(`@fonderie/core`, `@fonderie/client`, `@fonderie/config`), `@atelier` est indisponible, et
`laboratoire` nommerait de toute façon la mauvaise relation — un laboratoire est le lieu où l'on
**expérimente**, quand celui qu'on nomme est celui où l'on **fabrique**.

**`studio`**, proposé pour être plus explicite sur les cibles — CMS et framework e-commerce. Quatre
raisons :

1. Le scope `@studio` est **pris** et vivant (`@studio/log`, `@studio/ndjson`).
2. **Dire la nature des produits n'est pas le travail du nom de famille** : ce sont les produits qui
   la disent. Le dépôt a déjà écarté deux fois ce mouvement — `@prisme-cms` parce qu'il *« fige la
   nature du produit dans un nom qu'on ne change plus »* (ADR-0062), et `@repo/markdown` parce qu'il
   *« nomme l'outil et non le concept »* (ADR-0061 §10).
3. **Il privilégie une moitié** : « studio » évoque l'outillage créatif, couvre le CMS et ne dit rien
   du commerce. ADR-0058 refuse qu'un des deux frères pèse plus que l'autre.
4. **Il collide dans le domaine même du produit** : *Sanity Studio* désigne l'interface d'édition.
   Prisme aura une administration ; le mot serait pris deux fois.

**`@axiome-atelier`** — le niveau du milieu fusionné dans le scope. Il fait porter deux niveaux à un
objet qui n'en exprime qu'un, et rallonge chaque nom pour redire une appartenance que le préfixe dit
déjà.

**Les noms nus sous `@axiome-apps`** — ADR-0062 §4 telle qu'écrite, défaite au §4 ci-dessus.

**Un scope par produit** — déjà écarté par ADR-0062 §3, et l'argument tient : un scope n'aurait porté
qu'un seul paquet, le SDK, le produit lui-même étant une image Docker.

## Conséquences

- **Aucun préalable.** `@axiome-apps` est déjà réservé et le token npm reconnecté : il n'y a ni
  organisation à créer, ni *trusted publishers* à déplacer. C'est le bénéfice pratique le plus net
  face à un scope dédié.
- **Trois renommages, plus un à la publication** : `@mrcasquette/content` →
  `@axiome-apps/atelier-content`, `@echoppe/client` → `@axiome-apps/echoppe-client`, et `@repo/prose`
  → `@axiome-apps/atelier-prose` quand il sortira. Les versions gardent leur continuité — un paquet
  neuf qui débute en `0.3.1` n'a rien d'anormal, et le CHANGELOG reste lisible d'un bout à l'autre.
- **Le mot `atelier` n'engage plus grand-chose.** Il est un préfixe, pas une organisation : s'il
  déplaît un jour, en changer coûte un renommage de paquets, jamais une migration de compte.
- **`AGENTS.md` disait « `atelier` est un workspace, pas un produit ».** Ça reste vrai, mais c'est
  devenu incomplet : il est aussi le niveau dont les paquets partagés portent le nom. À amender.
- **La dépréciation des anciens noms se décide après publication**, pas avant : elle n'a de sens
  qu'une fois le nouveau nom servi par le registre.
- **Trois pièges opérationnels**, relevés sur le code le 2026-08-24 : deux changesets en attente
  nomment les paquets renommés et feraient échouer la release
  (`contrat-provider-communication.md`, `paquets-publies-sans-assertion.md`) ; `scripts/ship.ts` porte
  une table `canal → nom` **en dur**, ce que les gardes du dépôt s'interdisent par ailleurs ; et le
  template de `create-echoppe` importe le SDK — c'est ce que reçoit une boutique neuve.
- **Ce qui ne se réécrit pas** : les ADR — ADR-0062 documente exprès les anciens noms —, les
  `CHANGELOG.md` et les audits datés.
- **L'obligation de métadonnées d'ADR-0062 §6 est inchangée, et toujours bloquée** : `repository`
  pointerait vers un dépôt privé, donc vers un 404. Le sujet reste lié à la visibilité du dépôt.
- **Aucune garde ne vérifie ces règles**, pas plus qu'ADR-0062 n'en avait : ni qu'un paquet publié
  porte son préfixe d'appartenance, ni qu'un `@repo/*` ne devienne publiable par distraction.
