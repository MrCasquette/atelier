# ADR-0065 — Un fichier de configuration porte une nature, pas un produit par défaut

Statut : accepté · 2026-08-24
Portée : socle

> Amende [ADR-0055](./ADR-0055-publics-de-la-configuration.md), dont la décision « un seul `.env`
> dans le dépôt, tous les scripts lisent la racine, **sans exception** » supposait un seul produit
> exécutable.

## Contexte

La naissance de `prisme-api` a fait apparaître un second produit qui tourne sur le poste du
contributeur. Il lui faut sa propre base — deux cœurs, deux bases, jamais le même processus
([ADR-0025](./ADR-0025-deux-produits-un-repo.md)) — et le `.env` racine n'en déclare qu'une.

Le premier réflexe fut d'ajouter `.env.prisme`, une surcharge facultative cumulée par les scripts de
Prisme. Il traitait le symptôme et laissait la cause : le `.env` racine ne portait pas « la
configuration », il portait **le poste** *et* **Échoppe**, sans que rien ne distingue les deux. Trois
conséquences, toutes vérifiées sur le fichier réel.

**Un produit était le défaut, l'autre était nommé.** `AGENTS.md` pose que les deux produits sont
frères et qu'aucun n'est le principal. Un `DATABASE_URL` nu qui signifie « Échoppe » contredit cet
invariant à l'endroit le plus quotidien qui soit.

**La panne évitée l'était par un commentaire.** Sans `.env.prisme`, `bun run prisme:db:push`
s'exécute sur la base d'Échoppe et propose d'en supprimer toutes les tables du commerce, que le
manifeste de Prisme ne connaît pas. Ce dépôt remplace les avertissements par des gardes ; il venait
d'en ajouter un.

**Le fichier mentait déjà.** `POSTGRES_USER` et `POSTGRES_DB` y sont documentées comme « lues par
`compose.yaml` » : elles sont codées en dur dans le service, et seule `POSTGRES_PASSWORD` est
variabilisée. Un fichier qui mélange deux natures accumule ce genre de scorie sans que personne la
voie, parce qu'aucune ligne n'a de raison d'être relue.

## Les cas, un par un

ADR-0055 avait un seul axe, le **public**. Il en manquait deux, qui n'existaient pas encore : le
**produit**, et la **pile** sur laquelle il tourne.

| Ce qui lit de la configuration | Ce qu'il lit | Nature |
|---|---|---|
| `docker compose up -d` — l'infra du poste | `POSTGRES_PASSWORD` | **le poste** |
| `bun run dev` — Échoppe depuis les sources, rang 1 | `DATABASE_URL`, `ENCRYPTION_KEY`, `REDIS_URL`, `ADMIN_URL`, `STORE_URL` | **un produit sur ce poste** |
| `bun run dev:prisme` — Prisme depuis les sources, rang 1 | `DATABASE_URL` | **un produit sur ce poste** |
| `db:*` de chaque cœur | le `DATABASE_URL` de SON produit | **un produit sur ce poste** |
| les harnais (`test:api`, `test:image`, `contracts`) | `TEST_DATABASE_URL`, `DISPOSABLE_DB`, `INTEGRATION_IMAGE`… | ni l'un ni l'autre — **le script les pose** |
| une boutique créée par `create-echoppe` | `COMPOSE_PROJECT_NAME`, `PUBLIC_API_URL`, `CONTENT_API_KEY`… | **une instance livrée** |

*(Amendé le 2026-08-25 : le profil `release` est retiré, et les noms de commandes de ce tableau
ont changé — `dev echoppe`, `db prisme migrate`. Ce qui tient, et qui est le propos de cet ADR,
c'est la NATURE de ce que chacune lit ; cf. [ADR-0066](./ADR-0066-ce-qui-execute-nomme-son-produit.md).)*

Trois natures en sortent, et elles ne se recouvrent pas :

1. **Le poste** — ce qui monte l'infra locale et n'appartient à aucun produit.
2. **Un produit sur ce poste** — ce dont un produit a besoin pour tourner depuis les sources. Il y en
   a autant que de produits exécutables.
3. **Une instance livrée** — un public différent, une pile différente, un fichier qui quitte le
   dépôt. C'est déjà `create-<produit>/template/.env.example`, et il ne bouge pas.

La troisième mérite d'être défendue, parce qu'elle ressemble à la deuxième et qu'on est tenté de les
fusionner. Elle décrit un produit **installé** : rang 0, image publiée, front séparé, préfixe de
projet Compose. La deuxième décrit des **sources qui tournent** : rang 1, serveur Vite, pas d'image.
Leurs variables se recouvrent en partie (`ENCRYPTION_KEY`, `STORE_URL`, `API_PORT`) et divergent sur
le reste. Les fusionner recréerait exactement les « deux `.env` jumeaux » qu'ADR-0055 a supprimés,
un cran plus haut.

## Options envisagées

- **Garder `.env` comme défaut, ajouter des surcharges facultatives** — un seul fichier à copier pour
  démarrer, mais le produit implicite subsiste et la panne destructive reste tenue par un
  commentaire. C'est l'état livré le matin même, et c'est ce qu'on corrige.
- **Nommer les deux bases dans le `.env` racine** (`ECHOPPE_DATABASE_URL`, `PRISME_DATABASE_URL`),
  remappées par un lanceur — un seul fichier, aucun produit implicite, mais deux vocabulaires : le
  fichier du contributeur ne nomme plus les variables que le produit lit réellement, et l'exploitant
  en a un troisième.
- **Un `.env.<produit>.example` versionné par produit, copié par le contributeur** — symétrique et
  sûr, mais il ajoute une copie par produit et laisse le dépôt sans configuration qui marche. Et il
  se contredit sur la première nature : un fichier qui décrit **ce poste** n'a pas d'exemple à
  versionner, puisqu'il n'existe que sur cette machine.
- **Versionner les défauts, isoler le local.**

## Décision

### Ce qui est propre à la machine n'est jamais versionné ; ce qui est un défaut de dev l'est toujours

```
.env                      ignoré    · LE POSTE — lu automatiquement par Docker Compose,
                                      par aucun script Bun
.env.echoppe              VERSIONNÉ · les défauts d'Échoppe sur un poste de dev
.env.echoppe.local        ignoré    · les secrets et les écarts de CE poste
.env.prisme               VERSIONNÉ · les défauts de Prisme
.env.prisme.local         ignoré

packages/create-<produit>/template/.env.example   inchangé · une instance livrée
```

Les scripts d'un produit lisent **deux** fichiers, dans cet ordre :
`--env-file=../../.env.<produit> --env-file=../../.env.<produit>.local`. Bun applique les fichiers
dans l'ordre, le dernier gagne — donc le poste l'emporte toujours sur le défaut, jamais l'inverse —
et **un fichier absent est ignoré sans erreur**, ce qui rend le `.local` facultatif.

Le `.env` racine sort de cette chaîne. Il ne servait plus qu'à Docker Compose, qui le lit **tout
seul** depuis la racine du projet : le faire lire aussi par les scripts Bun était la confusion
d'origine.

### Le `.env.example` racine disparaît

Il n'a plus de destinataire. Ce qu'il documentait pour Échoppe est désormais un fichier qui *marche*,
versionné ; ce qu'il documentait pour Compose a des défauts dans `compose.yaml` lui-même
(`${POSTGRES_PASSWORD:-echoppe}`). Un exemple n'a de sens que pour un fichier qu'on ne peut pas
livrer rempli — ce n'est plus le cas d'aucun des deux.

**Un dépôt fraîchement cloné tourne donc sans qu'on copie quoi que ce soit.** C'est l'inverse du
constat qui avait motivé ADR-0055, où le contributeur butait à l'étape 3 sans savoir quel fichier
copier : il n'y a plus de fichier à copier.

### Pourquoi le produit est versionné et le poste ne l'est pas, et pas le contraire

C'est la seule répartition qui ne fait entrer aucun secret dans git. Versionner `.env` reviendrait à
suivre un fichier que chaque contributeur a déjà rempli de vraies valeurs sur sa machine — la clé de
chiffrement d'abord. Un fichier de produit, lui, naît vide de secrets et le reste par construction :
il ne porte que des adresses de développement (`localhost`, `echoppe:echoppe`) qui n'ont de valeur
nulle part ailleurs.

`ENCRYPTION_KEY` est l'unique secret que le développement exige. Il est déclaré **vide** dans
`.env.echoppe`, ce qui n'a rien d'un oubli : le garde-fou d'`apps/echoppe-api/src/env.ts` refuse
alors de démarrer en nommant la variable, et le commentaire dit où la mettre. Un secret ne peut pas
être silencieusement absent, et il ne peut pas non plus arriver dans le fichier suivi par
inadvertance, puisque celui-ci le déclare déjà.

### `DATABASE_URL` quitte le `.env` racine

C'est la conséquence qui protège. Une commande de schéma lancée sans le fichier de son produit ne
vise plus une base au hasard : elle **refuse de démarrer**, avec le message du garde-fou qui nomme la
variable manquante. L'avertissement en commentaire — « sans `.env.prisme`, `prisme:db:push` propose
de supprimer les tables du commerce » — disparaît, remplacé par un refus.

### Ce qui reste hors de ces fichiers

Les variables des harnais — `TEST_DATABASE_URL`, `DISPOSABLE_DB`, `INTEGRATION_IMAGE`, `PREV_IMAGE`,
`CONTRACT_API_URL` — ne sont dans aucun `.env` et n'y entrent pas : ce sont les scripts qui les
posent, et un harnais qui lirait un fichier d'environnement pourrait tomber sur une base qui n'est
pas jetable. La règle est inchangée, elle est seulement écrite.

## Conséquences

- ADR-0055 garde ses trois publics ; sa décision « un seul `.env`, sans exception » ne vaut plus. Ce
  qui a changé n'est pas son raisonnement, c'est le nombre de produits exécutables — un axe que le
  dépôt n'avait pas encore.
- Son option écartée « supprimer le `.env.example` racine » est retenue ici, mais pour une raison
  qu'elle n'avait pas : à l'époque, le supprimer laissait un poste neuf devant une page blanche.
  Aujourd'hui il ne laisse rien, parce que les défauts sont versionnés.
- `docker compose up -d` ne provisionne qu'une base. Celle du second produit reste un `CREATE
  DATABASE` manuel — dette inscrite au backlog socle, à lever quand la pile du dépôt aura à monter
  deux produits.
- Le commentaire sur `POSTGRES_USER` / `POSTGRES_DB` disparaît avec le fichier : `compose.yaml` les
  code en dur, il ne les a jamais lues.
- La divergence entre ces fichiers et les variables réellement lues par le code reste tenue par
  `docs/guide/configuration.md`, sans garde — même dette qu'ADR-0055, et pour la même raison : la
  surface bouge encore.
- `create-prisme` n'a pas de template. Il en aura un, et il vaudra pour la troisième nature, pas
  pour la deuxième.
