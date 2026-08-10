# ADR-0045 — Clés étrangères d'une entité : la cible déclare son stockage, la déclaration dit la politique

Statut : accepté · 2026-08-10
Portée : content

## Contexte

[ADR-0027](./ADR-0027-entites-tables-reelles.md) a écarté le jsonb pour les entités avec un argument
précis : « Pour un CMS dont le modèle est un graphe d'entités qui se référencent, ces garanties sont
l'infrastructure. » Les garanties en question sont celles de la base — intégrité référentielle,
comportement à la suppression, résistance à un écrivain concurrent.

Le mécanisme livré par [#33](../../README.md) dérive pourtant les champs `image` et `ref` en `uuid`
**sans clé étrangère**. L'argument qui a fait choisir les vraies tables n'est donc pas encore tenu :

- rien ne dit ce qui référence quoi, donc pas de « impossible de supprimer, utilisé sur 3 pages » ;
- pas d'`ON DELETE` — la suppression d'un média laisse un uuid qui ne pointe nulle part ;
- vérifier avant d'écrire n'est pas atomique : deux requêtes concurrentes passent la vérification
  puis écrivent, et l'une des deux ment (TOCTOU) ;
- surtout, **une garantie applicative ne protège que de l'intérieur**. Un `psql`, un outil de
  reprise, un script de migration écrivent sans passer par l'API — et c'est précisément le scénario
  que la souveraineté des données revendique comme normal.

Ce qui bloquait : le socle ne sait pas dans quelle **table** vit une cible. Le registre de
références ([ADR-0032](./ADR-0032-cibles-referencables.md)) expose `name`, `label`, `link`,
`project()`, `search()` — de quoi résoudre un lien, pas de quoi écrire un `REFERENCES`. Un
`ReferenceTarget` est délibérément une **projection**, pas une table.

## Décision

### 1. Une cible peut déclarer son stockage, et ce n'est pas obligatoire

`ReferenceTarget` gagne un champ **optionnel** :

```ts
storage?: { table: string };
```

Symétrique de `link` : `link` dit comment fabriquer une URL, `storage` dit où vit la ligne. Et
**opt-in comme le registre lui-même** — ADR-0032 pose déjà que « ce qui rend une entité
référençable, ce n'est pas d'être déclarée, c'est d'avoir une URL ». Même forme ici : ce qui rend
une cible contraignable, c'est de dire où elle vit. Le silence n'est pas une faute.

Une cible adossée à une vue, à une table partitionnée, à un système externe reste légitime — elle
garde `uuid` sans FK, exactement le comportement d'aujourd'hui. La dégradation est **silencieuse par
construction et bruyante à la lecture** : `content check` affiche le SQL, donc l'absence de
`references` s'y voit.

L'alternative — une carte `{ product: 'product', page: 'page' }` passée au push — a été écartée :
elle crée une **seconde liste** à tenir d'accord avec le registre, exactement le doublon
qu'[ADR-0038](./ADR-0038-ressources-ouvertes-delegation.md) a refusé pour les ressources RBAC.

`@repo/entities` reste sans opinion : il ne connaît ni `media` ni `product`, il reçoit la
correspondance de l'appelant — même idiome que `validateEntityData(…, components)` et
`isValidScopeFor(…, entityNames)`.

### 2. `image` vise `media`, et le cœur a déjà dit comment

`product.image`, `customer.avatar`, `document.pdf` référencent tous `media(id)` en
`ON DELETE SET NULL`. Il n'y a pas de politique à inventer, seulement à ne pas contredire : un champ
`image` d'entité est une FK vers `media(id)` de plus.

### 3. La politique de suppression se DÉDUIT de `required`

Aucun réglage nouveau dans le DSL — la déclaration le dit déjà :

| Déclaration | Colonne | `ON DELETE` |
|---|---|---|
| `f.image()` | `uuid` | `set null` |
| `f.image({ required: true })` | `uuid not null` | `restrict` |
| `f.ref('product')` | `uuid` | `set null` |
| `f.ref('product', { required: true })` | `uuid not null` | `restrict` |

Le raisonnement tient en une phrase : **une colonne `NOT NULL` ne peut pas devenir nulle.** Déclarer
`set null` dessus n'empêche pas la suppression d'échouer — Postgres refuse quand même, mais sur une
violation de contrainte NOT NULL, c'est-à-dire le bon comportement dit de la pire façon. `restrict`
énonce l'intention, et produit un message qui nomme la table qui retient.

C'est aussi ce qui rend possible le « utilisé sur 3 pages » : un champ obligatoire retient sa cible.
Un champ optionnel ne la retient pas — supprimer un média reste possible, il se vide.

### 4. Une FK vers une entité est un second motif de refus, pas une cascade

Les entités ne sont pas encore inscrites au registre de références (c'est
[#29](../../README.md)) : le cas ne se produit donc pas encore. Le mécanisme l'anticipe sans le
traiter à part, parce qu'il n'a rien de spécial — une entité inscrite déclarera
`storage: { table: 'entity_<nom>' }` et sera contrainte comme les autres.

Sa seule conséquence propre : Postgres refuse de supprimer une table qui porte une FK entrante.
[ADR-0028](./ADR-0028-activation-entites.md) refuse déjà la suppression d'une entité dont la table
n'est pas vide ; une FK entrante ajoute un second motif de refus, et c'est **cohérent** — jamais de
cascade, jamais de destruction implicite. Le refus doit nommer l'entité qui retient, pas remonter
une erreur SQL brute.

### 5. Les tables existantes s'alignent par `ALTER`, et le refus est franc

Les installations qui portent déjà des entités ont des colonnes `uuid` nues. La contrainte s'ajoute
par `alter table … add constraint … foreign key`, une opération **non destructrice** — mais qui
**échoue si des valeurs pendantes existent** (un uuid qui ne désigne plus rien).

Ce n'est pas un cas à contourner : c'est de la donnée déjà cassée, que l'absence de FK laissait
passer. Le plan la refuse comme un `blocker`, en disant combien de lignes sont en cause et sur quelle
colonne. On ne nettoie pas d'office — effacer des références serait une destruction implicite, ce que
le mécanisme refuse partout ailleurs.

## Conséquences

- L'argument d'ADR-0027 est tenu : le graphe d'entités a l'intégrité de la base, y compris face à un
  écrivain qui ne passe pas par l'API.
- Une cible référençable peut désormais parler de son stockage. C'est une entorse assumée à sa
  pureté de projection — bornée à un nom de table, optionnelle, et sans laquelle la garantie est
  inatteignable.
- Supprimer un média devient impossible tant qu'une entité l'exige. C'est le comportement voulu ;
  l'écran des médias devra le dire lisiblement plutôt que d'afficher une erreur SQL.
- `content check` devient plus bavard sur les entités existantes : il propose les FK manquantes.
  Un dépôt qui n'utilise ni `image` ni `ref` ne voit aucune différence.

## Ce que cet ADR ne tranche pas

- **Les champs `list`, `repeater` et `component` restent en jsonb**, y compris quand ils contiennent
  un `image` ou un `ref` imbriqué. Contraindre l'intérieur d'un jsonb demanderait une table fille par
  champ — hors de ce que le DSL sait dire (ADR-0027, « l'expressivité est bornée »). La dette est
  nommée ici pour ne pas être découverte plus tard.
- **L'affichage du « utilisé par »** : la FK rend l'information *disponible*, elle ne fabrique pas
  l'écran qui la montre.
