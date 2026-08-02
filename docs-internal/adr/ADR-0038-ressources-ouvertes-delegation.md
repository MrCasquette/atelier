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
