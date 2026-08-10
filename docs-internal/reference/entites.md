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

## Ce qui garde le mécanisme

| Garde | Où | Ce qu'elle refuse |
|---|---|---|
| Liste blanche d'identifiants | `packages/entities/src/ddl.ts` | tout nom hors `[a-z][a-z0-9_]*`, avant qu'il n'atteigne le SQL |
| Droit `schema` | `modules/content/entity/index.ts` | un éditeur — dériver une table est un acte de structure |
| Confirmation explicite | `pushEntities(registry, confirmDestructive)` | toute perte de données non voulue : **409**, avec ce qu'elle aurait détruit |
| Table non vide | `planEntities` | la suppression d'une entité qui contient encore quelque chose. Jamais de cascade |
| `unique check (singleton)` | la table elle-même | la seconde ligne d'un singleton — c'est Postgres qui refuse, pas le code |

On **refuse** un identifiant plutôt que de l'échapper. Échapper une chaîne libre, c'est accepter
n'importe quoi et espérer que le doublage des guillemets suffise ; une liste blanche ne s'en remet
jamais à ça.

## Ce que le mécanisme ne sait pas faire

- **Changer le type d'un champ.** Le rendre sûr demande de décider comment convertir chaque valeur
  déjà écrite, ce qu'aucune déclaration ne dit. Un champ dont le type change se **renomme** : ajout
  puis retrait, dont le second est visiblement destructeur — ce qu'il est.
- **Changer la cardinalité d'une table non vide.** Le slug d'une liste n'a pas d'équivalent sur un
  singleton. Videz-la d'abord.
- **Poser des clés étrangères** sur les champs `image` et `ref`. C'est la dette la plus sérieuse du
  mécanisme, cf. tâche #36.
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
| `apps/echoppe-api/src/modules/content/entity/` | les trois routes et leurs codes HTTP |
| `packages/echoppe-core/src/db/schema/index.ts` | inclut le **journal** dans les migrations du cœur (ADR-0025) |
