# ADR-0049 — Le schema est une séquence de champs, pas un dictionnaire

Statut : accepté · 2026-08-12
Portée : content

Corrige [ADR-0026](./ADR-0026-sections-entites.md) sur la **forme** du schema — le concept partagé
ne change pas, sa représentation sérialisée oui. Rend caduque le contournement de #46.

## Contexte

`fields` est un objet dont les clés sont les noms de champs :

```json
{ "titre": {…}, "sousTitre": {…}, "corps": {…} }
```

Cet objet signifie **deux choses à la fois** : un dictionnaire nom → définition, et une séquence
ordonnée — car `DynamicForm` construit le formulaire d'administration avec `Object.entries(fields)`,
donc l'ordre de déclaration du dev est l'ordre d'affichage. L'ordre est une information métier, et
il est encodé dans la seule construction JSON qui n'en garantit rien.

**#46 avait constaté le symptôme et acheté un contournement.** `jsonb` normalise les clés d'objet —
par longueur puis par octet — donc `titre, sousTitre, corps` ressortait `corps, titre, sousTitre` et
le formulaire affichait des champs dans un ordre que personne n'avait choisi. On a fait passer
`content_definition.fields` et `entity_definition.fields` en `json`, qui stocke du texte brut et
préserve donc les clés telles qu'écrites.

Ça marchait, et ça coûtait deux choses. Un **type anormal** dans un schéma où tout le reste est
`jsonb`, qu'il faut défendre par un commentaire sur deux colonnes et une migration pour qu'un
lecteur ne l'« optimise » pas en ressuscitant le bug. Et surtout : **ça ne corrigeait qu'un maillon
sur deux.**

### Un second maillon, que la séquence ne répare pas

JavaScript a sa propre règle de réordonnancement. `OrdinaryOwnPropertyKeys` énumère d'abord les clés
qui ressemblent à un index de tableau, **par ordre numérique croissant**, puis les autres dans
l'ordre d'insertion :

```js
Object.keys({ titre: 1, '2024': 2, corps: 3, '7': 4 })
// → ['7', '2024', 'titre', 'corps']
```

C'est atteignable : les entités sont protégées par la liste blanche d'identifiants de `ddl.ts`
(`/^[a-z][a-z0-9_]*$/`), mais les sections et composants déclaraient
`fields: t.Record(t.String(), …)`, sans contrainte de forme sur le nom.

**Point important, établi en implémentant** : ce brouillage a lieu dans **l'objet littéral que le dev
écrit**, donc avant `serializeFields` et avant tout stockage. Ni `json`, ni la séquence ne le
rattrapent — un test l'a démontré en échouant. C'est une limite du support d'écriture, pas du
transport. Elle appelle donc un refus, pas une conversion (décision 6).

## Décision

### 1. `fields` devient un tableau ordonné

Le nom du champ, qui était la **clé**, devient une **propriété** :

```json
[ { "name": "titre", "kind": "text" },
  { "name": "sousTitre", "kind": "text" },
  { "name": "corps", "kind": "richText" } ]
```

Un tableau JSON est ordonné **par définition** (RFC 8259 §5 : *« An array is an ordered sequence of
zero or more values »*). L'ordre cesse d'être une propriété fragile de la représentation pour
devenir la structure elle-même.

On n'essaie plus de préserver l'ordre des clés — on **arrête d'y encoder de l'ordre**.

### 2. Retour à `jsonb`

`jsonb` préserve l'ordre des éléments d'un tableau. Vérifié sur 50 éléments de longueurs mélangées,
en ordre anti-alphabétique et anti-longueur : identique au retour.

Ce n'est pas empirique. La documentation PostgreSQL énumère ce que `jsonb` ne conserve pas — les
espaces, **l'ordre des clés d'objet**, les clés dupliquées — et les tableaux n'y figurent pas :
les réordonner reviendrait à stocker un autre document. En interne, un tableau `jsonb` est un
vecteur de `JEntry` en ordre de document.

Les clés **à l'intérieur** de chaque élément continueront d'être réordonnées. Sans conséquence :
elles sont lues par leur nom (`field.kind`), jamais par leur position, et rien n'y a jamais été
encodé.

Le type redevient le défaut du dépôt. Plus de commentaire à défendre, et plus rien à ressusciter.

### 3. Pas de champ `sort`

L'ordre est porté par la position, jamais par une valeur.

Les deux `sort` existants — `section.sort`, `folder.sortOrder` — portent sur des **lignes SQL**, qui
n'ont aucun ordre propre : un `SELECT` sans `ORDER BY` rend ce qui arrange Postgres. Les
matérialiser y est obligatoire. Un tableau JSON, lui, **est** ordonné : un `sort` y serait une
seconde expression du même fait.

Deux vérités pour un fait peuvent diverger (`[{sort:3},{sort:1}]` est stockable), il faut alors
décider laquelle fait foi. Ça demande une renumérotation à chaque insertion au milieu, ou des trous
qui finissent par se cogner. Et surtout : **il faudrait y penser à chaque lecture**. Un oubli de tri
dans un seul des consommateurs ramènerait exactement la classe de bug qu'on corrige, en moins
visible. L'ordre d'itération d'un tableau ne s'oublie pas.

Un `sort` deviendrait légitime le jour où l'ordre serait modifiable **indépendamment de la
déclaration** — un écran qui réordonne sans toucher au fichier du dev. Ce n'est pas le cas : le push
est un remplacement intégral, et même une déclaration créée depuis l'administration serait réécrite
entière.

### 4. Le DSL ne change pas — la sérialisation, si

Le dev continue d'écrire un objet littéral, qui est la bonne syntaxe pour déclarer :

```ts
defineEntity('article', { fields: { titre: field.text(), sousTitre: …, corps: … } });
```

`serializeFields` (`packages/content/src/serialize.ts`) est le **point de capture unique** : son
`Object.entries` lit l'ordre écrit dans le fichier TS, et émet désormais un tableau. L'objet reste
la forme d'**écriture**, le tableau devient la forme de **transport et de stockage**.

**INVARIANT — une seule capture.** Passé ce point, aucun consommateur ne reconstruit d'objet
indexé par nom en aval. Un `Object.fromEntries` au milieu de la chaîne réintroduirait la règle
d'énumération de JavaScript et donc le bug, silencieusement. Un test de non-régression le
verrouille, avec un champ nommé `2024` dans sa fixture.

### 5. L'unicité des noms devient une garde explicite

L'objet la donnait gratuitement — deux clés identiques ne coexistent pas. Un tableau l'admet. La
vérification rejoint `assertRegistryCoherent`, avec son test et son message.

C'est le seul coût réel du changement, et il est assumé : une garantie qui se voit vaut mieux
qu'une garantie qui tient à la forme du conteneur.

### 6. Un nom de champ commence par une lettre

`/^[a-zA-Z][a-zA-Z0-9_]*$/`, refusé au dev par le DSL (`assertFieldNames`) **et** à la frontière par
la grammaire — une clé d'API pousse ce qu'elle veut.

C'est la seule réponse tenable au second maillon. On ne peut pas garantir l'ordre d'un champ nommé
`2024` : il est déjà brouillé quand `defineSection` reçoit son objet. Entre promettre un ordre qu'on
ne tient pas et refuser le cas qui le casse, on refuse — et on le dit dans le message d'erreur.

Les entités vivaient déjà sous une règle plus stricte (`ddl.ts`, minuscules seulement, parce que le
nom devient une colonne SQL). Celle-ci ne la remplace pas, elle couvre les sections et composants,
dont les champs vont en `jsonb` et n'avaient aucune contrainte.

### 7. Un adaptateur statique pour Elysia

Depuis que `fields` est un tableau, `Static<>` du schéma récursif traverse un `t.Array`. TypeScript
n'arrive alors plus à prouver que ce type est égal à lui-même à travers les génériques de route
d'Elysia : trois routes cessent de compiler (`/content/registry`, `/content/entities`,
`/content/entities/mine`) alors que le type est assignable en direct. Ni le modèle nommé, ni
l'annotation du handler n'y changent rien — vérifié un par un.

`serializedFieldSchema` devient donc `t.Unsafe<SerializedField>(serializedFieldShape)`, où
`SerializedField` est écrit à la main. **La validation runtime et le schéma OpenAPI émis sont
identiques** — on passe le vrai schéma récursif, et le JSON produit est le même (testé). On dit
seulement à TypeScript quel type lire.

C'est un contournement de framework, pas un modèle : il disparaît le jour où l'inférence récursive
d'Elysia encaisse un tableau. La duplication n'est tolérable que **verrouillée**, et le verrou tient
en deux contrôles complémentaires, dans `definition-model.test.ts` :

- **assignabilité mutuelle** — voit les propriétés requises, les mauvais types, un membre entier
  absent. Aveugle à la disparition d'une propriété optionnelle : `{ a?: number }` et `{}` sont
  mutuellement assignables, et la grammaire compte 26 `t.Optional` ;
- **égalité des `keyof`, membre par membre** — voit ça. Sur l'union entière elle ne verrait rien :
  `keyof (A | B)` rend l'**intersection** des clés.

Deux pièges à connaître, tous deux rencontrés : `[X] extends [never]` et non `X extends never`, sans
quoi le conditionnel se distribue sur l'union vide et le verrou s'auto-annule dans le cas même qu'il
doit attraper ; et la forme **explicite par `kind`**, la version générique sur un type mappé étant
vacue — avec un `K` générique, TypeScript diffère `Extract` et tout s'effondre en `never`.

**On ne réduit pas le DSL pour contourner ça.** Un répéteur dans un répéteur reste déclarable, et
l'administration le rend — trois composants s'appellent en récursion mutuelle pour ça. Faire dériver
une amputation du langage d'une limite d'inférence confondrait deux décisions.

## Conséquences

**Aucune migration de données.** `syncRegistry` fait `delete` puis `insert` — le registre est un
miroir des fichiers du dev, réécrit à chaque `content push`, pas un état accumulé. Le prochain push
écrit le nouveau format. Même chose pour le journal des entités. La migration SQL ne change que le
**type** des deux colonnes.

**Un déploiement existant doit repousser son contenu** après mise à jour, sinon une déclaration
restée au format objet sera refusée à la lecture par la grammaire. C'est la même contrainte que
celle déjà documentée pour `db:push` et les tables d'entités.

**Le format sérialisé de `@mrcasquette/content` change** — breaking pour un paquet publié. Fait
maintenant parce que c'est son coût minimum : une seule version publiée (`0.2.0`), pré-1.0, et le
chemin consommateur externe n'est pas encore validé. Ce coût-là est le seul du lot qui croisse avec
le temps.

**Fait avant [#35](../backlog/shared.md)**, qui sortira la grammaire des champs de `@repo/pages` :
un module se rend correct avant de changer de paquet, sans quoi l'opération se paie deux fois.

Onze parcours passent de `Object.entries(fields)` à une itération de tableau, dans le DSL,
`@repo/pages`, `@repo/entities`, l'administration et l'API.
