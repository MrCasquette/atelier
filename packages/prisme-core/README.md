# `@prisme/core`

> Le cœur du produit **Prisme** : il possède la base et ses migrations ([ADR-0025](../../docs-internal/adr/ADR-0025-deux-produits-un-repo.md)).

## Ce qu'il porte

**Ses migrations, et rien d'autre pour l'instant.**

Prisme ne déclare **aucune table en propre**. Ses tables — utilisateurs, droits, médias, identité,
journal des entités, pages, menus — appartiennent toutes aux paquets `@repo/*`, et il les *embarque*
dans son propre historique de migration. C'est la règle d'`AGENTS.md` rendue exécutable : une
capacité qui ne parle que de contenu vit dans les paquets partagés, et un cœur ne fait que la
recomposer.

Un cœur quasi vide reste donc nécessaire : ce qui le justifie est la **propriété des migrations**,
pas un schéma.

## Ce qu'il ne portera jamais

Une capacité partagée ne se réexporte pas d'ici. `db` s'importe depuis `@repo/db`, `media` depuis
`@repo/assets`, `user` depuis `@repo/auth`. La garde `core-passthrough` le vérifie sur les points
d'entrée **déclarés** du manifeste — c'est pourquoi le manifeste des migrations vit dans
`src/db/schema/migrations.ts`, hors des `exports` : rien ne peut l'importer.

## Sa base n'est pas celle d'Échoppe

Deux produits, deux cœurs, **deux bases** — jamais dans le même processus, jamais dans la même base.
Sur un poste de développement, les deux cohabitent pourtant, et le `.env` racine ne porte qu'un
`DATABASE_URL`.

D'où le second fichier, **optionnel** : `.env.prisme`, à la racine, qui ne redéclare que ce qui
diffère. Les scripts cumulent les deux — `--env-file=../../.env --env-file=../../.env.prisme` —, le
dernier gagne, et un fichier absent est ignoré sans erreur. Un contributeur qui ne travaille que sur
Prisme n'a donc rien à créer : il pointe `DATABASE_URL` sur la base de Prisme et c'est tout.

> ⚠️ Sans ce fichier, `bun run --cwd packages/prisme-core db:push` s'exécute sur la base que
> `DATABASE_URL` désigne. Si c'est celle d'Échoppe, Drizzle proposera de **supprimer** toutes les
> tables du commerce, qu'il ne connaît pas. `db:generate`, lui, est hors-ligne et sans risque.

## Commandes

```bash
bun run --cwd packages/prisme-core db:generate   # migration à partir du manifeste (hors-ligne)
bun run --cwd packages/prisme-core db:migrate    # appliquer
bun run --cwd packages/prisme-core db:studio     # explorer
```
