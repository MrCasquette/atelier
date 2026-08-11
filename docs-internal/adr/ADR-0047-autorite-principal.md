# ADR-0047 — L'autorité d'un principal : le propriétaire, l'administrateur par soustraction

Statut : accepté · 2026-08-11
Portée : auth

Amende [ADR-0038](./ADR-0038-ressources-ouvertes-delegation.md) — l'espace des ressources y était
ouvert, la façon de les **détenir** y restait une énumération.

## Contexte

[ADR-0038](./ADR-0038-ressources-ouvertes-delegation.md) a ouvert l'espace des ressources
(`entity:${string}`) et posé la règle de délégation. Mais elle n'a pas touché à la façon dont un
principal détient ses droits : une `Map<resource, PermissionSet>` alimentée par des lignes en base,
plus un booléen `bypass` pour le propriétaire.

Cette forme a une conséquence mécanique que personne n'a décidée : **le seed énumère les ressources
de l'Administrateur une par une** — une trentaine de lignes — donc **toute ressource nouvelle lui
échappe par défaut**.

Constaté en donnant à l'administration ses écrans d'entités (#37) : un Administrateur qui pousse une
entité ne la voit pas. Ni dans sa navigation, ni sur son écran. Il a le droit de **dériver la
table** — `schema` lui est accordé, verrouillé — et aucun droit de lire ce qu'il vient de créer.

Ce n'est pas un oubli du seed. C'est sa forme : une liste ne peut pas contenir ce qui n'existait pas
quand on l'a écrite. Le prochain concept produira le même écart.

### Ce que la question n'était pas

« Créer rend-il propriétaire ? » — non, et pas par prudence : **le créateur est presque toujours une
machine**. `content push` part de la CLI avec une clé d'API, qui n'a ni sujet (`hasSubject: false`),
ni rôle, ni utilisateur. Il n'y a personne à qui accorder quoi que ce soit. Une règle qui parlerait
du créateur serait muette exactement dans le cas qui compte, et confondrait dans l'autre *déployer*
et *rédiger* : celui qui pousse une déclaration n'est pas forcément celui qui édite le contenu.

### Où est la sécurité, réellement

Au moment où l'on donne **le droit de créer**, pas au moment où l'on regarde. Et ce moment est déjà
clos : `schema` appartient à `RANK_BOUND_RESOURCES` — jamais transmissible, *même par qui le
détient* — et le seed ne l'accorde qu'à `owner` et `admin`, verrouillé. L'ensemble de ceux qui
peuvent dériver une table **ne peut pas grandir** : ni par délégation, ni par clé d'API, ni par rôle
sur mesure.

Faire découler la visibilité de ce droit n'ouvre donc aucune surface. On rend explicite ce que la
porte d'entrée a déjà décidé.

## Décision

### 1. Un principal a une AUTORITÉ, pas une carte de droits

`permissions: Map` et `bypass: boolean` fusionnent en une seule notion :

```ts
type Authority =
  | { kind: 'total' }                    // le propriétaire de l'installation
  | { kind: 'except'; …listes… }         // l'administrateur — tout, moins ce qui est nommé
  | { kind: 'granted'; permissions: Map<string, PermissionSet> };  // tout le reste

function holds(authority: Authority, resource: string, action: Action): boolean;
```

**Un seul prédicat, posé aux deux endroits qui posaient la question séparément** : le garde
(`hasPermission`) et la délégation (`undelegatableGrants`, `undelegatableScopes`). C'est ce qui rend
la soustraction utilisable — sans lui, un Administrateur défini par complémentaire aurait une Map
vide et ne pourrait **rien** déléguer, alors qu'il détient tout.

`bypass` cesse d'être une dérogation en dur testée à quatre endroits : il devient le cas `total`.
La décision **retire** un cas particulier, elle n'en ajoute pas.

Une Map dit un ensemble fini. « Tout sauf » est un complémentaire — aucune Map ne l'exprime sans
énumérer l'univers, c'est-à-dire sans redevenir le seed qu'on remplace.

### 2. L'Administrateur est défini par soustraction

> **Admin = tout, moins la gouvernance sensible.**

Ce qui s'énumère, ce n'est plus ce qu'on donne, c'est ce qu'on **retire** — et chaque retrait tient
en une phrase :

| Liste | Sens | Contenu | Pourquoi |
|---|---|---|---|
| `reserved` | pas détenu du tout | `payment_config`, `communication_config` | Le sensible reste au propriétaire. Ce sont des credentials : les lire, c'est les avoir. |
| `readOnly` | lu, jamais écrit | `audit_log` | Un journal d'audit qui se modifie ne vaut rien. En soustraction pure, l'Admin y gagnerait le CRUD. |
| `ownRowsOnly` | détenu, borné à ses lignes | `api_key` | Chaque administrateur gère **ses** clés, pas celles des autres — le `selfOnly` que le seed pose aujourd'hui. |

Tout le reste lui revient, **`role`, `permission` et `user` compris**. C'est le point : un
administrateur qui ne peut pas configurer le RBAC n'est pas un administrateur, c'est un utilisateur
sur mesure avec un nom flatteur.

### 3. `reserved` et `RANK_BOUND_RESOURCES` sont deux mécanismes, tous deux nécessaires

À ne pas confondre — ils répondent à des questions différentes :

| | Question | Exemple |
|---|---|---|
| `reserved` | **détiens-tu ?** | `payment_config` : non, jamais. |
| `RANK_BOUND_RESOURCES` | **peux-tu transmettre ?** | `schema` : détenu par l'Admin, jamais délégable. |

### 4. Supprimer un utilisateur du premier rang est un acte du propriétaire

L'Administrateur reçoit `user` en entier. La borne n'est pas une ressource — c'est une règle de
**ligne**, que le modèle (ressource × action × `selfOnly`) ne sait pas exprimer.

Elle vit donc dans une garde du module `user`, sur le précédent exact d'`isFirstRank`, qui réserve
déjà la **révocation** au rang avec l'argument « retirer un droit est un acte de gouvernance, pas un
acte de domaine ». Supprimer un utilisateur du premier rang est le même acte.

Le propriétaire reste ce que son nom dit : un Administrateur ne peut pas le supprimer, ni supprimer
un autre Administrateur.

Et **conférer** le rang en fait partie — sans quoi la règle ne garde rien : il suffirait de créer un
pair avec un mot de passe qu'on choisit, de s'y connecter, et de supprimer par procuration. La garde
porte donc sur l'ACTE, pas sur le verbe HTTP : supprimer, désactiver, dégrader, promouvoir.

### 5. La propriété est un DRAPEAU, pas un rôle

> *Réécrite le 2026-08-11 — voir « Amendement » en fin de document. La rédaction initiale livrait
> `owner` et `admin` comme deux rôles du premier rang.*

Le framework livre **un seul** rôle d'administration : `admin`. Le propriétaire, c'est
`user.isOwner` — et rien d'autre.

`public` (et `customer`, côté Échoppe seulement — c'est du vocabulaire commerce) ne sont pas des
rôles d'administration : ce sont les principaux non authentifié et client. Ils restent.

**Aucun rédacteur livré** — qui a un besoin précis crée son rôle, et la délégation le borne.

### 6. La propriété se transfère, dans un seul sens à la fois

Seul le propriétaire transfère sa propriété. L'acte est **atomique** : le drapeau passe d'une
personne à l'autre, et l'ancien propriétaire redevient un Administrateur ordinaire.

**Il ne peut pas la reprendre.** Seul le nouveau propriétaire peut la lui rendre. Un transfert qu'on
pourrait annuler unilatéralement ne serait pas un transfert, ce serait un prêt — et le sortant
garderait de fait l'autorité qu'il est censé avoir cédée.

C'est ce qui permet à une installation de **survivre à une personne** : celui qui quitte l'entité
transmet, et sort réellement.

## Conséquences

### Ce que la soustraction change concrètement pour l'Administrateur

| Ressource | Avant | Après |
|---|---|---|
| `entity:<nom>` | rien | tout — **c'est l'écart qui a déclenché cette ADR** |
| `user` | aucun accès | tout, sauf supprimer un utilisateur du premier rang |
| `role`, `permission` | lecture seule verrouillée | tout |
| `identity`, `country`, `tax_rate`, `shipping_provider` | lecture seule | tout — c'est de la configuration |
| `payment_config`, `communication_config` | aucun accès | aucun accès (`reserved`) |
| `audit_log` | lecture seule | lecture seule (`readOnly`) |
| `api_key` | ses clés (`selfOnly`) | ses clés (`ownRowsOnly`) |
| `schema` | tout, verrouillé | tout, non transmissible (inchangé) |
| **toute ressource future** | **rien** | **tout** |

### Deux conséquences assumées

**Un Administrateur peut recopier ses DROITS, jamais son RANG.** Détenant `permission`, il fabrique
un rôle sur mesure portant les mêmes droits que lui, `permission:update` compris. Ce n'est pas une
élévation : il les a déjà, et c'est le sens ordinaire de « l'admin gère le RBAC ».

Mais ce rôle n'est **pas** du premier rang — `key` reste `null`, et le rang tient à `key`. Son
porteur ne peut donc ni révoquer, ni toucher à un utilisateur du rang. La différence n'est pas
cosmétique : voir la décision 4.

**Un Administrateur peut retirer les droits non verrouillés du rôle `owner`.** Retirer est réservé
au premier rang, dont il fait partie. La portée est faible : la puissance du propriétaire vient de
`user.isOwner` → `total`, pas de son rôle ; seul un utilisateur portant le rôle `owner` **sans**
`isOwner` serait affecté. On note, on ne ferme pas — fermer demanderait une notion de « rôle
intouchable » que rien d'autre ne réclame aujourd'hui.

### Ce qui devient inutile

- La règle spéciale envisagée « le premier rang détient `entity:*` » (tâche #47) : sans objet,
  l'entité est détenue parce que **tout** l'est.
- Une trentaine de lignes du seed.

## Ce que la décision ne tranche pas

- **La répartition Prisme / Échoppe des seeds.** `customer` est du vocabulaire commerce et ne part
  pas dans le socle ; le reste est à faire au moment de la scission.
- **Le `selfOnly` d'un principal `except`.** `ownRowsOnly` le porte pour `api_key` ; si un second
  cas apparaît, vérifier que la forme tient plutôt que de l'étendre par réflexe.
- **Un rôle sur mesure du premier rang.** `FIRST_RANK_ROLE_KEYS` reste une liste de clés portées par
  le code. Un rang sur mesure est un autre sujet.

## Alternatives écartées

**Créer rend propriétaire.** Le créateur est une machine dans le cas normal : la règle serait muette
là où elle compte. Et elle confondrait déployer et rédiger.

**Une règle spéciale « le premier rang détient toute entité ».** Elle règle le symptôme constaté et
laisse la cause : le prochain concept produira le même écart. Une liste dit *qui*, une règle dit
*pourquoi* — et seule la seconde survit à ce qu'on n'a pas encore écrit.

**Écrire des lignes `permission` à la poussée d'une entité.** Matérialiserait `entity:<nom>`, ce
qu'ADR-0038 refuse : la ressource est dérivée du registre, et c'est ce qui fait qu'un nom réutilisé
n'hérite de rien.

**Garder l'énumération et l'étoffer.** C'est le statu quo, et il est faux par construction : une
liste écrite aujourd'hui ne peut pas contenir ce qui existera demain.

---

## Amendement du 2026-08-11 — le drapeau est la vérité

La rédaction initiale gardait deux représentations du propriétaire : le rôle système `owner` et le
drapeau `user.isOwner`. Constaté juste après : **les permissions du rôle `owner` ne s'appliquent
jamais au vrai propriétaire** — son autorité `total` court-circuite avant qu'on les lise. Elles ne
peuvent donc prendre effet que sur quelqu'un qui n'est *pas* le propriétaire. Un rôle dont les
droits n'existent que pour qui ne devrait pas l'avoir.

Ce n'était pas seulement inélégant. La décision 2 venait de donner `user` à l'Administrateur, et
`POST /users` accepte un rôle arbitraire avec un mot de passe choisi par l'appelant : un
Administrateur pouvait créer un compte portant le rôle `owner`, s'y connecter, et récupérer ses
lignes — dont `payment_config` et `communication_config` en lecture et en écriture. Précisément ce
que la décision 2 lui réserve. Le drapeau `locked` n'y changeait rien : il empêche de modifier ces
lignes, pas de les recevoir en changeant de peau.

### Pourquoi le drapeau plutôt que le rôle

L'alternative était de faire du **rôle** la vérité (`key === 'owner'` → `total`). Écartée :

- « Qui est propriétaire » deviendrait une donnée assignable par une route ordinaire. L'élévation
  ci-dessus ne serait plus un défaut à corriger, elle serait la **structure**.
- « Un seul propriétaire » deviendrait inapplicable : un rôle se porte à plusieurs, par nature.
- Et on n'y gagnerait même pas « les droits au même endroit » : l'autorité du rôle serait `total`,
  donc ses lignes ne décideraient plus rien — exactement la situation de `admin` depuis la
  décision 2.

Le drapeau, lui, rend l'invariant **gratuit** : personne d'autre ne peut porter `total`, donc les
ressources réservées ne sont atteignables par aucun chemin. Pas « protégées par une garde » —
inatteignables. La décision ne bouche pas un trou, elle supprime la classe de trous.

Et elle remet chaque chose à sa place : la propriété est une **propriété d'une personne**, transmise
par un acte délibéré ; un rôle est une **description de fonction**, qu'on attribue en série.

### Ce que ça change

| | |
|---|---|
| Rôles livrés | `admin` seul (plus `public`, et `customer` côté Échoppe) |
| Rôle `owner` | supprimé — migration : ses porteurs passent à `admin` |
| `init-admin` | crée le premier compte en `admin` + `isOwner` |
| « Un seul » | index unique partiel sur `is_owner` — le commentaire du schéma le promettait, rien ne le tenait |
| Transfert | route dédiée, réservée au propriétaire (décision 6). Le drapeau n'était dans aucun corps de requête : il n'était pas « sûr », il était bloqué |
| Interface | « Propriétaire » devient un badge sur l'utilisateur, plus une ligne dans la liste des rôles |

### Une correction, découverte en écrivant la décision 4

La première rédaction de cet amendement affirmait qu'un Administrateur pouvait toujours créer un
second Administrateur — « latéral, pas ascendant ». **C'est faux, et ça vidait la décision 4 de son
contenu** : il lui suffisait de créer ce second Administrateur avec un mot de passe qu'il choisit,
de s'y connecter, et de supprimer par procuration celui qu'il ne peut pas toucher lui-même.

**Conférer le premier rang est donc un acte du propriétaire**, au même titre qu'y toucher — à la
création d'un utilisateur comme au changement de son rôle. Ce qui reste vrai, et suffit à l'usage
courant : un Administrateur crée autant de rôles sur mesure qu'il veut, avec ses propres droits.
Ce qu'il ne peut pas faire, c'est fabriquer un pair.
