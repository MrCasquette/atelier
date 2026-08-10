# ADR-0038 — Ressources ouvertes, délégation des droits, rôles système

Statut : accepté · 2026-08-02
Portée : auth

> Amende [ADR-0013](./ADR-0013-modele-rbac.md), dont le modèle — `role` + `permission`, bits CRUD,
> `selfOnly`, `locked`, bypass owner, cache par rôle — est **inchangé**. Ce qui change : la liste des
> ressources cesse d'être fermée, et l'administration des droits est bornée.

## Contexte

`RESOURCES` est une constante de 24 entrées, et `Resource` en dérive comme union fermée
(`constants/resources.ts:48`). Ce vocabulaire irrigue tout : `permissionGuard(resource, action)`
appelé dans 21 fichiers de routes, et `ApiKeyScope` construit par template literal sur `Resource`
(`plugins/apiKey.ts:30`).

[ADR-0027](./ADR-0027-entites-tables-reelles.md) rend cette liste **ouverte** : une entité déclarée
par le dev est une ressource à protéger, inconnue à la compilation du framework.

Par ailleurs, `PERMISSION` est une ressource unique avec ses bits CRUD — qui peut modifier une
permission peut modifier **toutes** les permissions. Il n'existe aucun moyen de borner un
administrateur à un sous-ensemble.

## Options envisagées

Pour ouvrir le vocabulaire :

- **`Resource = KnownResource | string`** — le plus simple, mais on perd toute vérification : une
  faute de frappe `permissionGuard('medai', 'read')` passerait silencieusement.
- **Registre intégral à l'exécution** — `RESOURCES` devient une table, tout est dynamique, y compris
  les ressources du framework. Uniforme, mais plus de typage ni d'autocomplétion dans les routes.
- **Deux espaces séparés.**

## Décision

### Deux espaces, l'espace des entités est préfixé

`RESOURCES` **reste fermé** pour le framework. Les entités vivent dans `entity:<nom>` :

```ts
type ProtectedResource = Resource | `entity:${string}`;
```

**Les fautes de frappe restent détectées** : `'medai'` ne correspond ni à l'union fermée ni au motif
préfixé. C'est ce qui rend cette option supérieure au simple `| string`.

Le préfixe donne aussi la maintenance : purger les permissions d'une entité supprimée est un
`LIKE 'entity:%'`. `permission.resource` est un `varchar(50)` et `unique(role, resource)` fonctionnent
inchangés.

Le travail réel est ailleurs : **valider qu'`entity:article` désigne une entité réellement
déclarée**, sinon des permissions s'accumulent sur du vide.

### Rien par défaut

Une entité nouvellement déclarée n'a **aucune permission**. Celui qui la pousse est nécessairement
Owner ou Admin — il détient donc `permission:update` et configure les droits dans la foulée. Il n'y a
pas de trou à combler par des droits en dur ni par un joker.

Une entité peut contenir des données sensibles — candidatures, messages. « Sans risque » vaut pour le
mécanisme, pas pour le contenu : le défaut fermé est le bon.

### On ne peut accorder que ce qu'on détient

Règle de délégation, action par action. Un rôle qui possède `entity:article` en CRUD peut l'accorder ;
il ne peut pas accorder `media:delete` s'il ne l'a pas.

Alternative écartée : une **portée d'administration** par catégories (framework / contenu / entités).
Elle demande une colonne, une classification explicite des 24 ressources et son maintien — et
surtout **elle autorise une élévation de privilèges** : un administrateur de la catégorie `entity`
peut s'ajouter `entity:candidature:read` à lui-même. La délégation le rend structurellement
impossible, sans aucun mécanisme supplémentaire.

Le bypass owner la court-circuite, et `locked` protège les lignes qui ne doivent jamais bouger.

**Limite assumée** : la règle confond « détenir un droit » et « pouvoir l'accorder ». Une séparation
des pouvoirs — ouvrir l'accès aux candidatures sans lire les CV — n'est pas exprimable. C'est un
besoin d'organisation à plusieurs personnes, hors cible ; la portée d'administration s'ajouterait
par-dessus sans rien casser.

### Amendement 2026-08-05 — retirer un droit est réservé au premier rang

La règle ci-dessus ne couvre que l'**attribution**. Or `PUT /roles/:id/permissions` remplace
l'ensemble des droits : ce qui n'est pas soumis est supprimé. Borner la seule attribution empêchait
l'élévation de privilèges mais laissait la **destruction** — un administrateur borné au catalogue ne
pouvait plus s'attribuer `user:delete`, mais pouvait soumettre son seul `product:read` sur le rôle
Administrateur et faire disparaître tout le reste. Il ne s'élevait plus ; il paralysait encore.

**Décision : la révocation est réservée au premier rang — Owner et Admin.**

Accorder et retirer ne sont pas symétriques. Accorder est **additif** et se borne naturellement à ce
qu'on détient : la possession est le bon critère. Retirer est **destructeur**, et son rayon d'action
n'est pas borné par la portée de celui qui retire — il désactive le travail des autres. C'est un acte
de **gouvernance**, pas un acte de domaine ; le **rang** est donc le bon critère, pas la possession.

**Conséquence assumée** : un Admin peut retirer un droit qu'il ne détient pas lui-même. C'est
exactement ce que « le rang autorise, la portée n'entre pas en compte » veut dire.

Le rang se lit sur `role.key` — immuable et porté par le code — jamais sur `name`, qui est de
l'affichage. Deux conséquences en découlent sans travail supplémentaire : une **clé d'API machine**
n'a pas de rôle, donc ne révoque jamais ; un **rôle créé depuis l'administration** a `key === null`,
donc ne révoque jamais non plus.

**Reporté** : un rang sur mesure, qui permettrait de déléguer la gouvernance à un rôle créé pour
l'occasion. Le besoin est réel dans une organisation à plusieurs, mais il demande de décider ce qui
fait rang — une colonne, une clé réservée, une permission dédiée — et rien ne presse tant que Owner
et Admin couvrent la cible.

### Les rôles système ont une clé stable

Aujourd'hui `rbac.ts` cherche `role.name === 'Client'` (l. 92) et `'Public'` (l. 100). Ce n'est pas un
bug — `roles.ts:161` refuse de modifier un rôle système — mais la protection est une garde de route,
pas une contrainte de base, et `name` est du **texte d'affichage** : si l'admin est traduit un jour,
l'authentification dépendrait d'une chaîne localisable.

Une colonne `key`, unique et immuable, portée par le code : `owner`, `admin`, `editor`, `client`,
`public`. `name` redevient purement de l'affichage.

### Les rôles de la surface admin

| Rôle | Droits |
|---|---|
| **Owner** | tout, non révocable |
| **Admin** | tout, y compris le schéma — sauf révoquer l'Owner |
| **Editor** | ce qu'on lui accorde, borné par la délégation |

**Pas de rôle `Dev`.** Deux mesures l'écartent :

- Un admin privé du schéma **ne perd rien en V1** : pousser une déclaration suppose des fichiers de
  code et la CLI ; la permission seule lui serait inutilisable.
- Un dev privé de l'écriture de contenu est **infirme** : il ne peut ni vérifier que son formulaire
  s'affiche, ni amorcer des données, ni réparer une fiche en débogage.

« Le dev n'écrit pas » est donc une **intention d'usage**, pas une permission — l'inscrire dans le
RBAC le paralyse sans rien protéger. Et donner tout à l'Admin prépare la V2, où un GUI de conception
de schémas s'adresserait précisément à lui.

En V1, le droit de schéma s'exerce depuis la CLI par une **clé d'API portant `write:schema`**, pas
depuis une session humaine.

## Conséquences

- `ApiKeyScope` gagne les variantes `entity:` ; `SCOPES`, aujourd'hui dérivé statiquement de
  `RESOURCE_LIST`, doit inclure les entités du registre à l'exécution ; `isValidScope` valide le
  motif contre le registre.
- L'écran d'édition des rôles itère `RESOURCE_LIST` **et** les entités déclarées.
- Le masquage d'une entité, laissé ouvert par [ADR-0028](./ADR-0028-activation-entites.md), se
  résout ici : **masquer, c'est retirer `canRead` à un rôle**. Le mécanisme existait déjà ; il lui
  manquait de pouvoir nommer une ressource inconnue à la compilation.
- `SCHEMA` devient une entrée de `RESOURCES`, accordée à Owner et Admin.

## Amendement 2026-08-10 — `schema` tient au rang, et la délégation vaut aussi pour les clés

Instruit avant d'implémenter #27 : `push` altère la structure de la base, il faut savoir qui peut
l'appeler avant d'écrire la route. Deux trous sont apparus.

### `schema` n'est pas une ligne de permission

La décision d'origine fait de `SCHEMA` « une entrée de `RESOURCES`, accordée à Owner et Admin ». Mais
une ressource ordinaire est **délégable** : par la règle « on ne peut accorder que ce qu'on détient »,
un Admin détient `schema`, donc un Admin peut l'accorder à un Editor. « Réservé à l'Owner et aux
admins » ne tenait alors que tant qu'aucun admin n'était généreux.

L'ADR répondait à demi — « un admin privé du schéma ne perd rien en V1, pousser suppose des fichiers
et la CLI ». C'est un argument d'ergonomie, pas de sécurité : la route accepte un cookie de session,
un `curl` suffit.

**Un éditeur ne doit pouvoir qu'éditer. Créer est d'une autre nature.** `schema` est donc attaché au
RANG, pas à la possession :

- le détenir découle d'être de premier rang — Owner par `bypass`, Admin par la clé de rôle système ;
- `undelegatableGrants` refuse toute ligne `schema:*` soumise, quel que soit le demandeur. Personne
  ne l'accorde, donc personne ne l'obtient.

C'est la même mécanique que la révocation, déjà gouvernée par le rang et non par la portée : retirer
un droit est un acte de gouvernance. Créer une table en est un aussi.

Coût assumé : une exception au modèle uniforme des ressources. Elle est justifiée par la nature de ce
qui est protégé — un droit dont l'objet est « seulement les deux premiers rangs » n'est pas une ligne
de permission, et en faire une garantit qu'il fuit.

### La délégation vaut aussi pour les scopes d'une clé d'API

`POST /api-keys` valide les scopes soumis contre le **vocabulaire** (`isValidScope`), jamais contre
ce que l'appelant détient. Une clé est pourtant une délégation d'autorité : la règle de la décision
d'origine doit s'y appliquer telle quelle.

Sans ça, `api_key:create` est un droit universel déguisé — qui le détient se forge une clé portant
n'importe quel scope. Non exploitable au seed, où seuls Owner et Admin reçoivent `api_key:create` ;
ouvert dès qu'un rôle sur mesure le reçoit, ce que la délégation autorise ; grave le jour où
`write:schema` existe, puisqu'il contournerait la règle de rang ci-dessus.

**Une clé ne peut porter que des scopes que son émetteur détient**, et `write:schema` n'est émissible
que par un premier rang. Le pendant de `undelegatableGrants`, appliqué aux scopes.

`api_key` reste exclu du vocabulaire de scopes : une clé ne peut jamais en engendrer d'autres. Cette
garantie-là tenait déjà par construction.

## Amendement 2026-08-10 (2) — la ressource d'une entité est dérivée, jamais matérialisée

Cet ADR ouvre l'espace des ressources à `entity:${string}` sans dire ce qui, concrètement, fait
exister `entity:article` au moment où l'entité naît. Deux lectures tenaient : écrire des lignes
`permission` à la poussée, ou dériver la liste du registre à la volée.

**Dérivée.** L'ensemble des ressources protégeables est `RESOURCES ∪ registre d'entités`, calculé à
la lecture. La poussée n'écrit rien de plus que ce qu'elle écrit déjà.

Le motif est celui de tout cet ADR, et celui d'[ADR-0027](./ADR-0027-entites-tables-reelles.md) : la
SSOT, ce sont les fichiers du dev. Matérialiser la ressource en créerait une seconde, qu'il faudrait
garder d'accord avec la première — et qui mentirait le jour où elles divergent.

Ça règle aussi, sans code, le troisième trou recensé dans #26 : une entité supprimée ne laisse pas de
ressource orpheline derrière elle, puisqu'aucune n'avait été écrite. Un `entity:ancien-nom` réutilisé
ne récupère rien.

**Ce que ça ne règle pas, et qu'il faut écrire.** Les droits ACCORDÉS, eux, sont bien des lignes
`permission` — c'est leur nature. Supprimer une entité doit donc purger les lignes qui la nomment,
sans quoi un nom réutilisé hériterait des droits de son homonyme. La différence avec la
matérialisation : ici on ne nettoie que ce qu'un humain a explicitement accordé, pas un état que le
système s'était fabriqué à lui-même.

Conséquence pour la surface : ce qui énumère les ressources — l'écran d'édition des rôles, la
validation d'un scope de clé — lit le registre en plus de `RESOURCE_LIST`.
