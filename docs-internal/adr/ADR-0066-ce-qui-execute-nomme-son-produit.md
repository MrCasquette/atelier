# ADR-0066 — Ce qui exécute nomme son produit, ce qui vérifie n'en nomme aucun

Statut : accepté · 2026-08-25
Portée : socle

> Complète [ADR-0054](./ADR-0054-ports-rang-de-pile.md) (rangs de pile) et
> [ADR-0065](./ADR-0065-configuration-par-nature.md) (fichiers de configuration), et amende une
> seconde fois [ADR-0004](./ADR-0004-migrations-release.md) §2 : la validation post-publication ne
> passe plus par un profil Compose.

## Contexte

`prisme-api` est devenu exécutable le 2026-08-24. Le dépôt s'est alors découvert **mono-produit dans
son outillage** alors qu'il se déclare bi-produit dans son architecture : `bun run dev` lançait
Échoppe, `bun run db:push` touchait la base d'Échoppe, `compose.yaml` montait l'infra d'Échoppe — et
rien dans ces noms ne le disait.

Le défaut n'est pas la duplication, c'est **l'implicite**. On ne pouvait pas lire une commande et
savoir quel produit elle exécutait. Prisme a dû se ranger à côté sous un préfixe (`dev:prisme`,
`prisme:db:*`), installant deux conventions à la racine : le produit tacite et le produit nommé.

### Ce que le dépôt est vraiment

Mesuré le 2026-08-25 : **dix-huit workspaces n'appartiennent à aucun produit** (treize `@repo/*`,
cinq publiés), sept en ont un. Le contributeur médian d'`atelier` ne travaille donc ni sur Échoppe ni
sur Prisme — il travaille sur le socle, et lui demander de choisir un camp serait un péage sur une
modification qui n'en a pas.

Trois postures existent, et deux seulement méritent d'être outillées :

| Posture | Ce qu'il touche | Ce dont il a besoin |
|---|---|---|
| **socle** — majoritaire | `@repo/*`, les paquets publiés | vérifier qu'il n'a rien cassé **des deux côtés** |
| **produit** | `apps/<produit>-*`, `<produit>-core` | **exécuter** un produit : sa pile, sa base, ses surfaces |
| **mainteneur** | tout | la somme des deux, sans outillage propre |

### Ce que les gardes ne couvrent pas, et qu'il fallait mesurer avant de décider

Deux sondes, jouées sur du vrai code le 2026-08-25 :

**Une colonne ajoutée à une table partagée est attrapée.** `drift-guard` découvre les deux cœurs,
constate la migration manquante chez l'autre produit et refuse. Le typage, lui, couvre les vingt
workspaces : une signature changée dans `@repo/*` casse chez les deux immédiatement.

**Une régression de comportement ne l'est pas.** En retirant le filtre `status = 'published'` de
`findPublishedPageBySlug` — une fuite des brouillons sur la surface publique — `lint`, `type-check`,
les tests unitaires, les sept gardes **et les 197 tests d'intégration** sont tous passés au vert.

Ce trou n'est pas né des deux produits, mais ils l'aggravent : un paquet partagé n'avait jusqu'ici
qu'un consommateur, dont la suite l'exerçait par ricochet. La décision ci-dessous est donc prise en
sachant que **la séparation ne protège pas à elle seule** — ce qui manque est inscrit au backlog
socle, garde de forme des tables partagées comprise.

## Options envisagées

- **Garder un produit implicite et préfixer l'autre** — l'état du 2026-08-24. Tenable à deux
  produits, illisible dès qu'on relit `bun run db:push` sans savoir quelle base il vise.
- **Une matrice de scripts nommés** (`db:echoppe:push`, `infra:prisme:up`…) — explicite et
  tab-complétable, mais c'est produits × verbes : seize lignes deviennent vingt-deux, et un
  troisième produit en ajoute onze. C'est le `package.json` qu'on ne relit plus.
- **Des dispatchers qui découvrent.**

## Décision

### L'invariant

> **Ce qui exécute un produit le nomme. Ce qui vérifie le dépôt n'en nomme aucun.**

La moitié vérification est déjà conforme et le restera : `lint`, `type-check`, `test`, les sept
gardes et `contracts:check` tournent sans base réelle, sur un `DATABASE_URL` factice. Ce sont les
outils de la posture socle, et ils n'ont jamais eu besoin d'un produit.

### Une pile par produit, et le dossier la nomme

Chaque produit possède sa pile : sa base dédiée, son Redis éventuel, son API.

```
infra/echoppe/compose.yaml     projet « echoppe »   postgres · redis
infra/prisme/compose.yaml      projet « prisme »    postgres
```

**Aucun `name:` n'est déclaré.** Mesuré : Compose déduit le nom de projet du **dossier contenant le
fichier**, d'où `echoppe_data` et `prisme_data` comme noms de volumes. Le chemin fait donc le travail
qu'un drapeau ferait moins bien, et il n'y a pas d'écart possible entre le nom du fichier et celui du
projet.

Le `compose.yaml` racine disparaît. Le `.env` racine avec lui : il n'avait plus de lecteur — aucun
script Bun ne le lit depuis ADR-0065, et Compose charge le `.env` du **répertoire du projet**, qui
devient `infra/<produit>/`.

### Les volumes existants sont détachés, et c'est assumé

Le projet actuel (`atelier`, dérivé du nom du dossier) porte `atelier_echoppe-data` et
`atelier_echoppe-redis`. Le passage à `echoppe` les détache.

C'est une base de **développement**, que `db seed` reconstruit en quelques secondes. Payer une
migration de volume pour elle installerait l'idée inverse, qu'elle compte. `dpc_*` — la pile d'essai
d'Échoppe — n'est jamais touchée : elle a son propre projet et n'entre pas dans ce chantier.

### Le profil `release` est retiré

Il annonçait, dans `compose.yaml` comme dans ADR-0004 §2, prouver qu'une image publiée « boote en
base vierge ». Vérifié : son service pointait le postgres du poste, la base `echoppe` et son volume —
donc une base déjà migrée par les `db:push` locaux, sans qu'aucun runbook ne demande de la vider.

La preuve est faite, et plus complètement, par `apps/echoppe-api/scripts/test-image.ts` : Postgres
éphémère, T2 base vierge, T3 montée depuis `:latest`, T4 parité du contrat, T5 idempotence des
seeds — en CI, comme gate de publication. C'est l'achèvement du déplacement commencé par ADR-0054,
non son inversion. Pour regarder tourner une image publiée, `docker run` ponctuel ou `test:image`
avec `INTEGRATION_IMAGE`.

### Les ports d'infrastructure ne demandent aucune grille

ADR-0054 répond déjà : *le produit ne possède que le port interne, le mapping vers l'hôte appartient
à l'instance.* Le port interne de Postgres est `5432` — celui de Postgres, pas le nôtre. Il n'y a donc
aucun produit à encoder dans le port publié ; il suffit qu'il ne collisionne pas.

| | Interne | Publié (développement) |
|---|---|---|
| Postgres Échoppe | `5432` | `5432` — inchangé |
| Postgres Prisme | `5432` | `5433` |
| Redis Échoppe | `6379` | `6379` — inchangé |
| Redis Prisme | — | aucun service (cf. sujets à discussion) |

Inventer un `5100 / 5200` casserait les défauts de `psql`, Drizzle Studio et tout client SQL pour
encoder une information qui n'appartient à personne. Et la surface est petite : ni la base d'une
boutique livrée ni `dpc-db` n'exposent de port hôte — seules les piles de développement du dépôt le
font, parce que `bun run dev` tourne sur l'hôte.

### Quatre dispatchers remplacent seize scripts

```
dev            bun run dev echoppe          bun run dev echoppe api
db             bun run db prisme migrate
infra          bun run infra echoppe down
integration    bun run integration echoppe image
```

`package.json` passe de **trente-huit à vingt-six scripts**, et ces quatre lignes ne rebougeront plus :
un troisième produit en ajoute **zéro**.

Ils **découvrent**, ils n'énumèrent pas — l'invariant de l'outillage, appliqué au lanceur :

| Découvre | Par quoi |
|---|---|
| les produits | les dossiers `infra/*/compose.yaml` |
| les surfaces d'un produit | les workspaces `apps/<produit>-*` qui déclarent un script `dev` |
| les verbes de base | les scripts `db:*` que déclare `packages/<produit>-core` |

Conséquence directe : « Prisme n'a pas de `seed` » n'est pas une phrase codée en dur, c'est une
lecture. Le jour où `prisme-core` en déclare un, la ligne apparaît sans que personne touche au
dispatcher.

### Un refus qui liste, jamais un assistant interactif

`bun run dev` sans produit **refuse** et affiche les produits découverts, en sortie `1`. Trois
raisons, dans l'ordre de force :

1. **Une commande incomplète qui « marche » entre dans les READMEs et dans les habitudes.** C'est
   très exactement le produit implicite qu'on supprime.
2. Un assistant ne fonctionne pas sans TTY — CI, hook, script appelant — et obligerait à écrire les
   deux chemins pour n'en servir qu'un.
3. Le dépôt refuse et nomme partout ailleurs : `env.ts` nomme la variable manquante, `drift-guard`
   nomme le workspace. Un assistant serait la première chose ici qui devine.

Ce refus remplace la complétion qu'on perd sur les commandes rares, et il vaut mieux qu'elle : une
liste découverte ne peut pas être en retard sur le dépôt.

### Ce que `dev <produit>` possède

| Étape | Idempotent | Dans `dev` |
|---|---|---|
| `infra <produit> up` (détaché) | oui — 0,08 s sur pile saine | **oui** |
| attendre le healthcheck | — | **oui** |
| `db <produit> migrate` | oui — 0,62 s à jour | **oui** |
| `db <produit> seed` | oui — `onConflictDoNothing`, gardé par T5 | **oui** |
| `db <produit> push` | **non** | **jamais** |
| les surfaces du produit | — | **oui** |

`up` toujours **détaché** : une infrastructure est une dépendance de fond, pas quelque chose qu'on
regarde. `Ctrl-C` arrête les surfaces, jamais la pile — qui survit à la session, et dont l'arrêt
reste un geste explicite.

`push` est le seul exclu, et pour une raison écrite dans l'architecture : sur une base qui porte des
entités, il **détruit leurs tables**, que Drizzle ne connaît pas puisqu'elles sont dérivées au push.
Celui qui édite un schéma l'appelle sciemment.

Un dépôt fraîchement cloné atteint donc un produit qui tourne, migré et peuplé, en une commande de
deux mots.

### La frontière que ces décisions ne traversent pas

Trois artefacts, trois vocabulaires, et ils ne se mélangent pas :

| Artefact | Ses commandes | Public ([ADR-0055](./ADR-0055-publics-de-la-configuration.md)) |
|---|---|---|
| le dépôt | `package.json`, vingt-six scripts | contributeur |
| l'image | **aucune** — zéro `package.json`, un binaire, sous-commandes `./api <verbe>` | exploitant |
| le projet livré | `package.json` scaffoldé, cinq scripts — le **front**, pas le produit | intégrateur |

Vérifié : le stage final du `Dockerfile` ne copie ni manifeste ni `node_modules`. Il n'existe donc
pas de « script de production » — et `scripts/run.ts` n'entre dans aucun artefact livré. C'est ce qui
rend ces décisions révisables sans rien casser chez personne : elles ne sont un contrat que pour le
contributeur.

## Conséquences

- `bun run dev`, `db:push` et leurs voisins **disparaissent**. Aucune compatibilité ascendante : ces
  noms sont ceux du produit implicite qu'on supprime, les garder les ferait survivre.
- `docker compose up -d` tapé à la racine cesse de marcher — `bun run infra <produit> up`, ou
  `cd infra/<produit>`. C'est le seul geste de la documentation à réécrire.
- ADR-0004 §2 porte encore l'affirmation retirée. Un ADR ne se réécrit pas : le pointeur daté est
  ajouté, comme ADR-0054 l'a fait avant.
- ADR-0065 tient sans modification, **pour une raison qu'elle ne connaissait pas**. Mesuré :
  `docker compose --env-file` cumule comme Bun, mais **échoue sur un fichier absent** là où Bun
  l'ignore. Un `.local` facultatif était donc incompatible avec Compose — c'est le dispatcher qui
  absorbe l'asymétrie, en ne passant le drapeau que si le fichier existe. Sans lui, il aurait fallu
  rendre ce fichier obligatoire, donc généré.
- Le `.env` racine disparaît, et la question de le renommer (`.env.docker`) tombe avec lui.
- La séparation **ne protège pas des régressions de comportement** dans un paquet partagé. Deux
  manques restent ouverts au backlog socle : la garde de forme des tables partagées entre cœurs, et
  la règle qu'un paquet partagé qui gagne du comportement gagne un test unitaire.
- Redis n'est décidé pour aucun des deux produits — le rate-limit n'a aucun repli et le `compose.yaml`
  livré n'en déclare pas. Sujet ouvert, porte de sortie : un ADR.
- `image-manifests` voit sa justification vieillir : elle dit qu'aucun motif Docker ne préserve
  l'arborescence, or `COPY --parents` le fait (vérifié : Docker 29.4.0, buildx 0.33,
  `# syntax=docker/dockerfile:1`). Le stage `deps` devient découvrable ; le stage `source` reste
  nommé, parce qu'il sélectionne ce dont l'image d'**un** produit a besoin.
- L'image de Prisme n'est pas de ce chantier : `apps/prisme-admin` est une sonde, il n'y a pas de
  second artefact à généraliser.
