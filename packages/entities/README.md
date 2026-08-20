# `@repo/entities` — une entité déclarée, sa table dérivée, son journal

Une entité est de la **donnée** : un `Article` garde tout son sens sans le CMS, donc il va en vraies
colonnes ([ADR-0026](../../docs-internal/adr/ADR-0026-sections-entites.md),
[ADR-0027](../../docs-internal/adr/ADR-0027-entites-tables-reelles.md)). Ce paquet contient la
mécanique qui l'y met : traduction déclaration → DDL, comparaison au schéma réel, application.

## Frontière

**Aucune route** — les codes HTTP sont du produit
([ADR-0044](../../docs-internal/adr/ADR-0044-surface-http-paquets-partages.md)). La grammaire des
**champs** vient de `@repo/fields` plutôt que d'être réécrite ici : une entité et une section les
décrivent de la même façon.

## Ce qui est particulier à ce paquet

**Les tables d'entités ne sont dans aucune migration.** La définition du *journal* l'est, comme toute
définition de table ; les tables dérivées, non — elles sont créées à la poussée. C'est le prix de la
condition sine qua non d'[ADR-0028](../../docs-internal/adr/ADR-0028-activation-entites.md), et il se
paie sur le drift guard.

Le journal (`entity_definition`) est l'équivalent de `__drizzle_migrations` pour les entités : sans
lui, on ne sait pas répondre à « cette entité a-t-elle déjà sa table ».

## La règle de sécurité, et elle n'a pas d'exception

Du SQL est généré depuis des noms venus d'un fichier. La réponse retenue **n'est pas d'échapper mais
de refuser** : une liste blanche ne s'en remet jamais au doublage des guillemets.

- Les **identifiants** — noms de tables et de colonnes — passent `isValidIdentifier` de `ddl.ts`, et
  un nom refusé ne produit jamais de SQL.
- Les **valeurs** sont toujours liées, jamais interpolées. `row-service.ts` et `write-service.ts`
  construisent leur SQL à la main, faute de table Drizzle — la règle y est d'autant plus stricte.

`addColumnSql`, `dropColumnSql` et `dropTableSql` valident le nom d'**entité** mais pas le nom de
**colonne**, parce qu'il leur arrive d'une source déjà sûre — `fieldColumns` pour l'un, la table
vivante pour l'autre. Un test consigne cette asymétrie : si un troisième appelant apparaît, elle
devient un trou.

## Les fonctions pures sont là où va l'effort de test

`ddl.ts` et `link.ts` ne touchent ni la base ni le transport, délibérément : une vérification de
cohérence n'a pas à exiger une `DATABASE_URL` pour se tester. Ce sont elles qu'il faut couvrir en
priorité — et le chemin **destructeur** (`alter`, `drop`) autant que celui qui crée.

## À lire aussi

[ADR-0039](../../docs-internal/adr/ADR-0039-entites-singleton.md) (cardinalité),
[ADR-0045](../../docs-internal/adr/ADR-0045-cles-etrangeres-entites.md) (clés étrangères),
[ADR-0046](../../docs-internal/adr/ADR-0046-entites-referencables.md) (une entité déclare son lien),
et [entites.md](../../docs-internal/architecture/entites.md) pour le détail.

## Dépendances

`@repo/db`, `@repo/auth`, `@repo/fields`, `@repo/references`, `drizzle-orm`, `elysia`.
