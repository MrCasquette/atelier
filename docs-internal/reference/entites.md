# Entités — de la déclaration à la table

Référence interne du mécanisme d'[ADR-0027](../adr/ADR-0027-entites-tables-reelles.md) et
[ADR-0028](../adr/ADR-0028-activation-entites.md). Pour le vocabulaire, voir
[lexique-prisme.md](./lexique-prisme.md) ; pour les blocs de page, voir
[content-module.md](./content-module.md).

## Le chemin

```
src/content/index.ts (dev, TS)
   │  defineEntity('article', { fields: { … } })
   ▼
CLI  content check           packages/content/src/cli.ts
   │  POST /content/entities/check     → rend le SQL, n'écrit RIEN
   ▼
CLI  content push [--force]
   │  PUT /content/entities            → applique, en transaction
   ▼
entity_definition            le JOURNAL — quelle entité existe, sous quelle déclaration
entity_article               la TABLE dérivée — vraies colonnes
```

Une seule commande côté dev : `content push` pousse les entités **puis** le registre de
définitions. Dans cet ordre, parce qu'une section peut référencer une entité et que le registre
refuse une cible inconnue.

## Lire et écrire

| Route | Audience | Droit |
|---|---|---|
| `GET /entities/:name` | front (contrat figé) | aucun — public |
| `GET /entities/:name/:slug` | front (contrat figé) | aucun — public |
| `GET /content/entities/mine` | administration | session privilégiée seule |
| `GET /content/entities/:name/rows` | administration | `entity:<nom>` read |
| `POST /content/entities/:name/rows` | administration | `entity:<nom>` create |
| `PUT /content/entities/:name/rows/:id` | administration | `entity:<nom>` update |
| `DELETE /content/entities/:name/rows/:id` | administration | `entity:<nom>` delete |

La ressource `entity:<nom>` n'est **écrite nulle part** : elle est dérivée du registre à chaque
requête (ADR-0038). La SSOT, ce sont les fichiers du dev ; la matérialiser créerait une seconde
source à garder d'accord. Conséquences directes :

- une entité fraîchement poussée est **refusée à tout rôle ordinaire**. C'est le bon défaut —
  l'inverse, visible par défaut, ne se rattrape pas. Le premier rang, lui, la détient sans qu'aucune
  ligne ne le dise : son autorité est une règle et non une carte (ADR-0047) ;
- masquer une entité, c'est retirer `canRead` à un rôle, pas poser un drapeau global ;
- une entité supprimée **emporte les droits accordés** sur elle, sans quoi un nom réutilisé
  hériterait de ceux de son homonyme.

Une clé d'API peut porter `read:entity:<nom>` / `write:entity:<nom>` : le vocabulaire de scopes est
élargi aux entités déclarées, à l'exécution. La règle de délégation vaut comme partout — on ne
délègue que ce qu'on détient.

## Se faire administrer

Une entité déclarée obtient ses écrans sans qu'aucun code ne soit écrit pour elle : une seule paire
de routes front (`/entites/:name`, `/entites/:name/:id`) sert toutes les entités, et ce qu'elles ont
de propre — champs, cardinalité, libellé, icône — vient de leur déclaration.

Le formulaire n'est pas écrit non plus : c'est **le générateur des sections**, sans une ligne de
plus. Une entité et une section décrivent leurs champs de la même façon (ADR-0026), donc
`DynamicForm` sait déjà les rendre, `component` et `list` compris.

La **cardinalité décide de la forme de l'écran** (ADR-0039) : une entité de liste ouvre un tableau
d'occurrences, un singleton ouvre son formulaire directement — il n'a rien à lister, et pas de slug
à saisir.

`GET /content/entities/mine` répond à une question distincte de celle du journal : non pas *quelles
entités existent* — c'est de la structure, et ça tient à `schema:read` — mais **ce que l'appelant
peut administrer**. Sans elle, un rédacteur à qui l'on vient d'accorder `entity:article` n'aurait
aucun chemin vers son propre écran, faute de détenir `schema`. Elle rend donc les déclarations qu'il
détient en lecture, chacune avec les actions qu'il détient : la navigation ne propose que
l'accordé, et l'écran n'offre pas un bouton qui sera refusé.

Une entité qui n'est accordée à personne n'apparaît nulle part, et son écran le **dit** — « cette
entité ne vous est pas accordée », avec le chemin vers l'écran des rôles. Un 403 brut laisserait
l'utilisateur devant une panne là où il n'y a qu'un droit à demander.

## Se faire citer

Une entité devient référençable — dans un menu, dans un champ `ref` — en déclarant **un lien**, et
rien d'autre (ADR-0046) :

```ts
defineEntity('article', { fields: { … }, link: { mode: 'route', route: '/blog/:slug' } });
```

| Mode | Ce qu'il dit | URL |
|---|---|---|
| `route` | l'entité EST une page | `:slug` substitué, le front peut la construire |
| `href` | le champ nommé PORTE l'URL | lue dans la ligne, rendue par l'API |
| `anchor` | le champ `ref` nommé désigne la parente | route de la parente + `#slug` |

`link` est **optionnel** : ce qui rend une entité citable est d'avoir une URL, pas d'être déclarée.
Sans lui, elle n'entre pas au registre et n'apparaît dans aucun sélecteur.

L'inscription se fait sous `entity:<nom>`, à la poussée et au démarrage de l'API — le registre est un
miroir du journal, jamais une source. Elle emporte le `storage`, donc un `ref` vers une entité porte
une **vraie clé étrangère** et sa suppression est refusée tant qu'on la référence.

`GET /roles/resources` est la seule liste de ce qui est protégeable : le vocabulaire du socle, plus
les `entity:<nom>` du journal, chacun avec le libellé que le dev lui a déclaré. L'administration ne
tient plus la sienne — c'est ce qui rendait `content`, `api_key` et `schema` inaccordables depuis
l'interface, et qui aurait rendu toute entité invisible.

Elle est **bornée à ce que le demandeur peut accorder**, action par action (`actions`) : une entité
qu'il ne détient pas n'y figure pas, et `schema` n'y figure jamais pour personne d'autre que le
propriétaire, puisqu'il tient au rang. `selfOnlyRequired` porte l'autre dimension : qui ne détient
un droit que sur ses propres lignes ne peut l'accorder que borné — c'est le cas d'un administrateur
sur `api_key`. La borne ne retire rien — retirer un droit n'est pas l'accorder, et l'écran resoumet
intactes les lignes qu'il n'affiche pas.

## Ce qui garde le mécanisme

| Garde | Où | Ce qu'elle refuse |
|---|---|---|
| Liste blanche d'identifiants | `packages/entities/src/ddl.ts` | tout nom hors `[a-z][a-z0-9_]*`, avant qu'il n'atteigne le SQL |
| Droit `schema` | `modules/content/entity/index.ts` | un éditeur — dériver une table est un acte de structure |
| Confirmation explicite | `pushEntities(registry, confirmDestructive)` | toute perte de données non voulue : **409**, avec ce qu'elle aurait détruit |
| Table non vide | `planEntities` | la suppression d'une entité qui contient encore quelque chose. Jamais de cascade |
| `unique check (singleton)` | la table elle-même | la seconde ligne d'un singleton — c'est Postgres qui refuse, pas le code |
| Clés étrangères | la table elle-même | un `image`/`ref` qui ne désigne rien, la suppression d'une cible qu'un champ obligatoire retient, et celle d'une entité que l'on référence (ADR-0045) |

Les clés étrangères ne sont pas seulement posées à la création : `check` propose celles qui manquent
aux tables déjà poussées, et l'opération n'est pas destructrice — poser une garantie ne perd rien.
Elle peut en revanche **échouer sur de la donnée pendante**, un uuid qui ne désigne plus rien. C'est
de la donnée déjà cassée que l'absence de contrainte laissait passer : le plan la refuse en disant
combien de lignes et sur quelle colonne. Jamais de nettoyage d'office.

Où vit une cible se déclare sur elle, dans `storage` (ADR-0045) — `page` dans `@repo/pages`, les
cibles commerce dans le registre d'Échoppe, et le nom est lu sur la table Drizzle, jamais recopié.
Une cible qui se tait laisse le champ en `uuid` nu : le silence est un état normal.

On **refuse** un identifiant plutôt que de l'échapper. Échapper une chaîne libre, c'est accepter
n'importe quoi et espérer que le doublage des guillemets suffise ; une liste blanche ne s'en remet
jamais à ça.

## Ce que le mécanisme ne sait pas faire

- **Changer le type d'un champ.** Le rendre sûr demande de décider comment convertir chaque valeur
  déjà écrite, ce qu'aucune déclaration ne dit. Un champ dont le type change se **renomme** : ajout
  puis retrait, dont le second est visiblement destructeur — ce qu'il est.
- **Changer la cardinalité d'une table non vide.** Le slug d'une liste n'a pas d'équivalent sur un
  singleton. Videz-la d'abord.
- **Contraindre l'intérieur d'un `jsonb`.** Un `image` ou un `ref` imbriqué dans un `component`, une
  `list` ou un `repeater` ne porte pas de clé étrangère : les atteindre demanderait une table fille
  par champ, hors de ce que le DSL sait dire. Les champs de premier niveau, eux, sont contraints
  (ADR-0045).

  Le stockage, lui, **respecte l'ordre déclaré** : `fields` est une **séquence** `[{ name, kind, … }]`
  et non un dictionnaire ([ADR-0049](../adr/ADR-0049-schema-sequence-de-champs.md)). Un tableau est
  ordonné par construction, donc `jsonb` le préserve — ce qui n'était pas vrai d'un objet, dont il
  trie les clés par longueur puis octet, si bien que le formulaire généré affichait les champs dans
  un ordre que personne n'avait choisi (#46).

  L'ordre est de l'information et pas de la présentation : c'est celui des colonnes dérivées, celui
  du formulaire d'administration, et c'est lui qui donne son sens au « premier champ texte » dont
  une occurrence tire son libellé.

  Deux bornes en découlent. Un nom de champ **commence par une lettre** — `{ '2024': … }` est déjà
  réordonné par JavaScript dans l'objet littéral du dev, avant toute sérialisation, donc on refuse
  le cas plutôt que de promettre un ordre qu'on ne tiendrait pas. Et **deux champs ne peuvent pas
  porter le même nom** : l'objet l'interdisait gratuitement, la séquence l'admet, donc `check` le
  refuse en nommant l'entité et le champ — sans quoi Postgres le dirait au push, trop tard et moins
  clairement.
- **Trier, filtrer ou paginer la liste des occurrences.** L'écran rend ce que la route rend, les
  plus récentes d'abord. Une entité qui grossit demandera mieux.
- **Contraindre un `enum` en base.** La valeur est déjà validée à la frontière par le schéma compilé
  depuis la même déclaration ; une contrainte nommée serait à faire évoluer à chaque option ajoutée.

## ⚠️ `db:push` ne connaît pas les tables d'entités

Le schéma d'une installation n'est plus entièrement déterminé par les fichiers de migration — c'est
le prix assumé de la condition sine qua non d'ADR-0028, et il se paie ici :

| Commande | Comportement |
|---|---|
| `db:generate` / `db:migrate` | ✅ ne lisent que les fichiers, ignorent les tables d'entités |
| `contracts:check`, drift guard CI | ✅ sans objet — les tables d'entités ne sont dans aucun schéma Drizzle |
| **`db:push`** | ⚠️ compare le schéma Drizzle à la base **vive** : il proposera de **supprimer** les tables d'entités |

En développement, `bun run db:push --force` sur une base qui porte des entités **détruit leurs
tables**. Utilisez `db:generate` puis `db:migrate`, ou repoussez vos entités après coup.

## Où vit quoi

| | |
|---|---|
| `packages/content` | `defineEntity`, sérialisation, CLI — temps-dev, publié (`@mrcasquette/content`) |
| `packages/entities` | journal, dérivation DDL, plan, application — aucune route (ADR-0044) |
| `apps/echoppe-api/src/modules/content/entity/` | les routes (structure, lecture front, administration) et leurs codes HTTP |
| `apps/echoppe-admin/src/views/Entity*.vue` | les deux écrans, génériques — un seul jeu pour toutes les entités |
| `packages/echoppe-core/src/db/schema/index.ts` | inclut le **journal** dans les migrations du cœur (ADR-0025) |
