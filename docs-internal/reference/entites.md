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
| `GET /content/entities/:name/rows` | administration | `entity:<nom>` read |
| `POST /content/entities/:name/rows` | administration | `entity:<nom>` create |
| `PUT /content/entities/:name/rows/:id` | administration | `entity:<nom>` update |
| `DELETE /content/entities/:name/rows/:id` | administration | `entity:<nom>` delete |

La ressource `entity:<nom>` n'est **écrite nulle part** : elle est dérivée du registre à chaque
requête (ADR-0038). La SSOT, ce sont les fichiers du dev ; la matérialiser créerait une seconde
source à garder d'accord. Conséquences directes :

- une entité fraîchement poussée est **refusée à tout le monde**, y compris à qui l'a poussée. C'est
  le bon défaut — l'inverse, visible par défaut, ne se rattrape pas ;
- masquer une entité, c'est retirer `canRead` à un rôle, pas poser un drapeau global ;
- une entité supprimée **emporte les droits accordés** sur elle, sans quoi un nom réutilisé
  hériterait de ceux de son homonyme.

Une clé d'API peut porter `read:entity:<nom>` / `write:entity:<nom>` : le vocabulaire de scopes est
élargi aux entités déclarées, à l'exécution. La règle de délégation vaut comme partout — on ne
délègue que ce qu'on détient.

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
- **Offrir des écrans d'administration.** L'API est complète et une entité est désormais
  **accordable** depuis l'écran des rôles — la matrice tient sa liste de `GET /roles/resources`, où
  les entités déclarées figurent au même titre que le reste. Mais il n'existe encore aucun écran
  pour **éditer** leurs occurrences, ni d'entrée dans la navigation (tâche #37, points 1 et 2).
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
| `packages/echoppe-core/src/db/schema/index.ts` | inclut le **journal** dans les migrations du cœur (ADR-0025) |
