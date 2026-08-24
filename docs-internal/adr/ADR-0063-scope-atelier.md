# ADR-0063 — Le scope nomme l'atelier, entre l'organisation et les produits

Statut : accepté · 2026-08-24
Portée : socle

Révise [ADR-0062](./ADR-0062-scope-et-critere-de-publication.md) sur deux points — le **scope** (§3)
et le **nom nu du SDK** (§4). Tout le reste de cette décision tient : le critère de publication, ce
que signifie `@repo/*`, les initializers non scopés, et l'obligation de métadonnées.

## Contexte

ADR-0062 a été acceptée le 22 août 2026 et n'a jamais été appliquée — aucun renommage n'a eu lieu.
Deux jours plus tard, au moment de l'appliquer, deux faits l'ont défaite. Aucun des deux n'était
connu quand elle a été écrite.

**Le premier est extérieur au dépôt : Axiome publie majoritairement des applications desktop.** Un
scope qui annonce l'organisation situe donc le paquet dans un catalogue où il n'a pas de voisins —
`@axiome-apps/prose` ne dit pas de quel outillage web il vient, et l'y chercher égare plus que ça
n'oriente.

**Le second est interne : le nom nu ne dit plus le rôle.** Sous `@echoppe`, le paquet `client` était
autosuffisant — le scope disait le produit, le nom disait le rôle. En déplaçant le scope vers
l'organisation, ADR-0062 §4 a fait dire au nom le **produit** : `@axiome-apps/echoppe` nomme un
framework entier, une image Docker, une API, une administration. Rien n'y dit qu'on installe son
client.

Un symptôme avait mis les deux au jour sans qu'on le comprenne : **`content` et `prose` sonnaient
creux.** On a cherché longuement un nom commun plus net — `definitions`, `definition-dsl`,
`schema-dsl`, `model-dsl` — et tous ont été écartés sur preuve. Le nom commun n'était pas le
problème.

## Décision

### 1. Il y a trois niveaux, pas deux

| Niveau | Ce que c'est | Ici |
|---|---|---|
| **Organisation** | l'entité qui publie, proche d'une marque | Axiome |
| **Atelier** | le lieu où l'on fabrique les outils du web | `atelier` |
| **Produit** | ce qui en sort, et qui a ses propres utilisateurs | Échoppe, Prisme |

ADR-0062 n'en voyait que deux, et a fait porter au premier le travail du second. C'est la racine de
tout ce qu'elle a mal tranché ensuite.

**L'atelier n'est ni une marque, ni un produit.** Il ne décrit pas la nature de ce qui en sort — il
décrit une **relation**, celle du lieu à sa production. C'est ce qui le sépare d'un nom de catégorie,
et c'est ce qui lui permet d'accueillir un troisième produit sans devenir faux.

Ce niveau existait déjà dans le dépôt, sans nom public : c'est exactement ce que
[ADR-0058](./ADR-0058-fraternite-des-produits.md) désigne quand elle dit que les deux produits
recomposent les mêmes paquets sans se traverser. Ce qui est décidé ici, c'est qu'il **se nomme**, et
qu'il se nomme dehors.

### 2. Le scope est `@atelier`

Le scope **situe** — c'est son unique travail, et il le fait mieux qu'un préfixe puisqu'il ne se
répète pas dans chaque nom.

```
@atelier/content          partagé — déclarer
@atelier/prose            partagé — rendre
@atelier/echoppe-client   produit — le SDK d'Échoppe
@atelier/prisme-client    produit — le SDK de Prisme, à venir
create-echoppe            initializer, non scopé
create-prisme             initializer, non scopé
```

Le mot est français, et ça n'est pas un accident. Le dépôt écrit ses ADR, ses backlogs et ses URL en
français par choix assumé ; `atelier` **signale l'artisanat** au lieu d'annoncer une catégorie, et il
reste lisible d'un anglophone — c'est un emprunt vivant en anglais dans l'artisanat, la mode et le
design, où il désigne précisément l'endroit où l'on fabrique.

### 3. Un paquet partagé porte sa matière ; un paquet lié à un produit porte son produit et son rôle

C'est la règle unique, et elle se lit sans être expliquée dans la liste ci-dessus.

**Elle clôt la question du nom commun**, celle qui avait résisté : un nom de matière n'est jamais
autosuffisant *seul* — il l'est **dans un contexte**, et le contexte est le rôle du scope.
`@atelier/content` ne pose aucun des problèmes de `@axiome-apps/content`. Chercher un nom commun plus
précis revenait à faire porter au nom le travail que le scope ne faisait pas.

Le pluriel et le singulier ne changent pas : [ADR-0061](./ADR-0061-prose-directives-declarees.md) §10
continue de trancher — matière au singulier, collection d'objets nommés au pluriel.

### 4. Le SDK est `echoppe-client`, pas `echoppe`

ADR-0062 §4 déduisait le nom nu de [ADR-0059](./ADR-0059-nom-nu-et-prefixe-de-scission.md). Elle en a
retenu la formule sans ses conditions, et ADR-0059 en pose trois, toutes nécessaires :

- **le préfixe naît d'une scission** — il n'y en a aucune ici, la règle ne s'appliquait donc pas au
  cas ;
- **le préfixe reprend le nom du concept scindé** — sans objet, même raison ;
- **on ne préfixe que ce qui en a besoin** : *« Registry ne dit pas de quoi il est le registre ;
  pages se suffit. »*

C'est cette troisième condition qui tranche, et elle tranche contre le nom nu : sous un scope qui
nomme le lieu et non le produit, `echoppe` est le cas « registry », pas le cas « pages ».

Le précédent invoqué — `stripe`, `algoliasearch`, `openai` — ne s'applique pas non plus : chez eux le
scope est **absent**, donc le nom nu porte les trois niveaux à lui seul. Ici le scope est déjà pris
par l'atelier.

Bénéfice qui n'était pas cherché : la symétrie avec `prisme-client` est immédiate, ce qu'ADR-0058
demande.

## Ce qui a été écarté

**`studio`**, proposé pour être plus explicite sur les cibles — CMS et framework e-commerce. Quatre
raisons, dans l'ordre de force :

1. **Le scope `@studio` est pris**, et vivant : `@studio/log` et `@studio/ndjson` sont publiés. Le
   bénéfice principal — un scope lisible — disparaît avant tout débat.
2. **Ce n'est pas le travail du nom de famille de dire la nature des produits.** Ce sont les produits
   qui la disent. Le dépôt a déjà écarté deux fois ce mouvement : `@prisme-cms` parce qu'il *« fige
   la nature du produit dans un nom qu'on ne change plus »* (ADR-0062), et `@repo/markdown` parce
   qu'il *« nomme l'outil et non le concept »* (ADR-0061 §10).
3. **Il privilégie une moitié.** « Studio » évoque l'outillage créatif : il couvre le CMS et ne dit
   rien du commerce. ADR-0058 refuse qu'un des deux frères pèse plus que l'autre.
4. **Il collide dans le domaine même du produit** : *Sanity Studio* désigne l'interface d'édition,
   pas le framework. Prisme aura une administration ; le mot serait pris deux fois.

**`@axiome-apps/atelier-prose`** — le niveau manquant porté par un préfixe plutôt que par le scope.
Écarté sur un défaut mécanique : **le préfixe casse sur les paquets produit.** Mis côte à côte,
`@axiome-apps/atelier-prose` et `@axiome-apps/echoppe-client` mettent au même emplacement l'atelier
et le produit — un lecteur ne peut pas en déduire la règle. Et la corriger en
`atelier-echoppe-client` donne vingt-neuf caractères pour dire trois fois la même appartenance.

**Un scope par produit** — déjà écarté par ADR-0062 §3, et l'argument tient toujours : un scope
n'aurait porté qu'un seul paquet, le SDK, puisque le produit lui-même est une image Docker.

**Garder `@axiome-apps`** — c'est ADR-0062 telle qu'écrite, défaite par les deux faits du § Contexte.

## Conséquences

- **`@atelier` reste à réserver, et c'est la seule inconnue.** La disponibilité d'un scope npm ne se
  teste pas depuis le registre public ; seul un `npm org create` la tranche. Si le nom est pris, **le
  raisonnement des trois niveaux ne change pas** — seul le mot change, et les §1 à §4 s'appliquent au
  nom de repli.
- **`AGENTS.md` dit « `atelier` est un workspace, pas un produit ».** Ça reste vrai — l'atelier n'est
  pas un produit — mais c'est devenu incomplet : il est aussi le niveau qui nomme les paquets
  publiés. À amender.
- **`@axiome-apps` a été réservé et n'aura jamais rien publié.** Aucune rupture : rien n'est sorti
  sous ce scope.
- **Trois renommages, plus un à la publication** : `@mrcasquette/content` → `@atelier/content`,
  `@echoppe/client` → `@atelier/echoppe-client`, et `@repo/prose` → `@atelier/prose` quand il sortira.
  Les versions gardent leur continuité — un paquet neuf qui débute en `0.3.1` n'a rien d'anormal, et
  le CHANGELOG reste lisible d'un bout à l'autre.
- **Les *trusted publishers* OIDC sont à refaire** sur la nouvelle organisation. Le
  [backlog socle](../backlog/shared.md) les listait déjà comme à vérifier ; ils sont maintenant à
  recréer.
- **La dépréciation des anciens noms se décide après publication**, pas avant : elle n'a de sens
  qu'une fois le nouveau nom servi par le registre.
- **Trois pièges opérationnels**, relevés sur le code le 2026-08-24 : deux changesets en attente
  nomment les paquets renommés et feraient échouer la release
  (`contrat-provider-communication.md`, `paquets-publies-sans-assertion.md`) ; `scripts/ship.ts`
  porte une table `canal → nom` **en dur**, ce que les gardes du dépôt s'interdisent par ailleurs ;
  et le template de `create-echoppe` importe le SDK — c'est ce que reçoit une boutique neuve.
- **Ce qui ne se réécrit pas** : les ADR — ADR-0062 documente exprès les anciens noms —, les
  `CHANGELOG.md` et les audits datés.
- **L'obligation de métadonnées d'ADR-0062 §6 est inchangée, et toujours bloquée** : `repository`
  pointerait vers un dépôt privé, donc vers un 404. Le sujet reste lié à la visibilité du dépôt.
- **Aucune garde ne vérifie ces règles**, pas plus qu'ADR-0062 n'en avait. Ni qu'un paquet publié
  porte son scope, ni qu'un `@repo/*` ne devienne publiable par distraction.
