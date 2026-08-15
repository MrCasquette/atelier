# `@repo/db` — la connexion et le vocabulaire de requête

Le paquet livre trois choses : la connexion applicative (`client`, `db`), le runner de migrations
(`runMigrations`), et le vocabulaire de requête de Drizzle réexporté.

## Frontière

**Ce paquet ne connaît aucun schéma.** C'est ce qui lui permet d'être en dessous de tout le monde :
les paquets partagés comme les cœurs produit en dépendent, il ne dépend de personne. La flèche va
toujours du produit vers le paquet
([ADR-0025](../../docs-internal/adr/ADR-0025-deux-produits-un-repo.md)), y compris pour l'accès base.

| Ici | Chez le cœur produit |
|---|---|
| La connexion, une par processus | Le barrel de schémas et `drizzle.config.ts` |
| Le **runner** de migrations, générique | Les **fichiers** de migration |

`runMigrations(migrationsFolder)` prend son dossier en paramètre : c'est ce qui permet à deux
produits d'avoir deux historiques distincts sans dupliquer le mécanisme.

## Deux points à connaître

**`db` n'est lié à aucun schéma.** L'argument `{ schema }` de `drizzle(client, { schema })` ne sert
qu'aux Relational Queries (`db.query.*`), dont le projet ne fait aucun usage — mesuré à 0 occurrence.
Un cœur qui en aurait besoin construit sa propre liaison à partir du même `client` : une connexion,
plusieurs liaisons possibles.

**Le `throw` à l'import est délibéré, mais ce n'est pas le message destiné à l'opérateur.** C'est
`apps/*/src/env.ts` qui produit le diagnostic lisible, en s'évaluant avant ce module.

## Pourquoi le vocabulaire de requête est réexporté

Pour qu'un paquet partagé n'ait pas à déclarer `drizzle-orm` en dépendance directe juste pour écrire
un `eq`.

`getTableName` en fait partie pour une raison précise : ce qui écrit du DDL visant une table — une
clé étrangère dérivée d'une entité
([ADR-0045](../../docs-internal/adr/ADR-0045-cles-etrangeres-entites.md)) — lit son nom **sur la table
elle-même** plutôt que de recopier une chaîne. Le schéma reste la seule source, et un renommage ne
peut pas laisser un littéral périmé derrière.

## Dépendances

`drizzle-orm` et `postgres`.
