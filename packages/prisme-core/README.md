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

Elle est déclarée dans **`.env.prisme`**, versionné, avec une adresse de développement qui marche
telle quelle ([ADR-0065](../../docs-internal/adr/ADR-0065-configuration-par-nature.md)). Ce qui est
propre à votre machine va dans `.env.prisme.local`, ignoré par git et facultatif. Les scripts lisent
les deux, dans cet ordre — le poste l'emporte toujours sur le défaut.

Ce fichier est ce qui rend la distinction **opérante** : sans lui, une commande de schéma de Prisme
n'aurait aucun `DATABASE_URL` et refuserait de démarrer, au lieu de viser silencieusement celle
d'Échoppe et de proposer d'en supprimer toutes les tables du commerce.

> `docker compose up -d` ne provisionne que la base d'Échoppe. Celle de Prisme se crée une fois :
> `docker compose exec postgres psql -U echoppe -c 'CREATE DATABASE prisme'`.

## Commandes

```bash
bun run --cwd packages/prisme-core db:generate   # migration à partir du manifeste (hors-ligne)
bun run --cwd packages/prisme-core db:migrate    # appliquer
bun run --cwd packages/prisme-core db:studio     # explorer
```
