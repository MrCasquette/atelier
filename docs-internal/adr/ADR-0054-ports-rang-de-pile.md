# ADR-0054 — Un port publié appartient à l'instance, pas au produit

Statut : accepté · 2026-08-18
Portée : socle

> Remplace l'allocation de [ports.md](../architecture/ports.md) (identité mathématique) et amende
> [ADR-0004](./ADR-0004-migrations-release.md), dont la validation pré-publication reposait sur
> `compose.dev.yaml`.

## Contexte

Les ports d'Échoppe portaient une identité mathématique — `3141` (π) pour le store, `3211`
(Fibonacci inversé) pour l'admin, `7532` (les premiers en miroir) pour l'API. Trois choses l'ont
vidée de son sens.

**[ADR-0052](./ADR-0052-surfaces-exploitation-image-unique.md) a supprimé deux ports sur trois.**
Le dashboard est servi par l'API sous `/-/admin` : il n'a plus de port. L'image publiée n'expose
plus qu'un seul port, et `3211` ne sert plus qu'au serveur Vite du développement. Il ne reste
d'identité à porter que sur un chiffre.

**Le décalage `+1` était déjà en contradiction avec lui-même.** `.env.example` documentait `7533`
pour le poste de travail, et `compose.dev.yaml` publiait `${API_PORT:-7533}` : les deux piles
locales visaient le même port. Le décalage résolvait le conflit avec une pile de démonstration et
en créait un second, silencieux.

**La collision dure n'était pas le port.** `compose.yaml` et `compose.dev.yaml` déclaraient tous
deux `container_name: echoppe-db` et `echoppe-api`. Docker refuse le second démarrage quels que
soient les ports. Le template livré par `create-echoppe`, lui, avait déjà la forme correcte
(`${COMPOSE_PROJECT_NAME:-echoppe}-db`) : le fichier destiné au consommateur était en avance sur
ceux du dépôt.

Le besoin réel est celui-ci : sur une même machine cohabitent une boutique construite avec le
framework, le framework en cours de développement, et la validation de l'image publiée. Aucune ne
doit exiger d'arbitrage manuel.

## Options envisagées

- **Maintenir l'identité mathématique** — elle ne décrit plus qu'un port sur six, et le décalage
  local qu'elle impose est devenu le problème qu'elle prétendait résoudre.
- **Allouer dynamiquement** (port libre au démarrage) — supprime toute collision, mais rend l'URL
  imprévisible : le proxy Vite, le SDK et les signets cessent de fonctionner sans découverte.
- **Une grille lisible, où le rang de pile est un chiffre.**

## Décision

### Le port publié appartient à l'instance

Le produit ne possède que le port **interne** du conteneur — celui du `Dockerfile`, de son `EXPOSE`
et de son healthcheck. Il vaut `8100` partout, dans toutes les piles, et ne se négocie pas. Le
mapping vers l'hôte est une propriété de l'instance qui tourne, jamais du produit.

### La grille

Trois chiffres portent le sens, et rien d'autre :

- **le millier dit la nature** — `8` un serveur, `3` un navigateur ;
- **la centaine dit le produit** — `1` Échoppe, `2` Prisme ;
- **l'unité dit le rang de l'instance sur la machine** — `0` la première, celle du produit lorsqu'il
  y en a un.

La dizaine reste libre pour distinguer plusieurs surfaces de même nature au sein d'un produit ; un
seul usage aujourd'hui : `1` pour le serveur Vite du dashboard.

| | Échoppe | Prisme |
|---|---|---|
| API — le produit (port interne, et boutique du consommateur) | `8100` | `8200` |
| API — `bun run dev` depuis les sources | `8101` | `8201` |
| API — validation de l'image publiée | `8102` | `8202` |
| Front — la vitrine du dépôt (`apps/echoppe-store`) | `3100` | `3200` |
| Dashboard, serveur Vite (développement seulement) | `3110` | `3210` |
| PostgreSQL · Redis | `5432` · `6379` | idem |

`bun run dev` prend le rang `1` parce que le rang `0` revient au produit : une boutique du
consommateur tourne sur `8100`, et le développement du framework ne doit pas la déloger.

Le front fait exception au rang : aucun front n'est livré comme produit — celui du consommateur
vit dans son propre dépôt (ADR-0002) et garde le port par défaut d'Astro, `4321`, qui ne nous
regarde pas. `3100` revient donc directement à la vitrine du dépôt.

PostgreSQL et Redis gardent leurs ports canoniques. Les déplacer coûterait de la surprise sans rien
acheter : la validation d'image auto-provisionne déjà sa propre base sur un port à elle
(`scripts/test-image.ts`), et le compose du consommateur ne publie pas sa base.

`8200` est le port par défaut de HashiCorp Vault et `3100` celui de Grafana Loki. Le risque est
accepté : ce sont des produits d'infrastructure spécifiques, pas des frameworks courants, et
l'exploitant qui fait tourner les deux sait déplacer un mapping.

### Les rangs sont des littéraux, pas une configuration

Chaque rang est écrit en dur dans le fichier qui définit sa pile. Aucun `.env` ne les porte, aucun
script ne les alloue, et rien n'est à arbitrer au démarrage : les trois piles cohabitent par
construction. `API_PORT` reste surchargeable — c'est la variable de l'exploitant, pas la nôtre.

### Un seul compose à la racine

`compose.dev.yaml` disparaît. Ses deux rôles s'étaient séparés : la validation de l'artefact
depuis les sources est couverte, et plus complètement, par `apps/echoppe-api/scripts/test-image.ts`
(migrations, idempotence au re-boot, upgrade depuis l'image n-1, parité du contrat SDK) ; ne restait
que la fourniture de PostgreSQL et Redis à `bun run dev`.

Le `compose.yaml` racine porte donc les deux moitiés, séparées par un profil Compose :

- `docker compose up -d` — PostgreSQL et Redis. L'infra du poste de travail, rien d'autre.
- `docker compose --profile release up -d` — ajoute l'image publiée, sur le rang `2`.

Ce fichier n'est **pas** une production et cesse de le prétendre : le consommateur reçoit
`packages/create-echoppe/template/compose.yaml`, recopié tel quel par la CLI.

### Aucun `container_name` littéral

Un nom de conteneur est global à la machine : deux piles qui en partagent un ne peuvent pas tourner
ensemble, même sur des ports distincts. Les composes du dépôt laissent Compose préfixer par le nom
de projet, comme le fait déjà le template livré.

## Conséquences

- `docs-internal/architecture/ports.md` est réécrit : l'identité mathématique et le décalage `+1`
  disparaissent, y compris la section « Pourquoi ces choix ».
- ADR-0004 est amendé : la validation pré-publication ne passe plus par `compose.dev.yaml` mais par
  le test d'intégration. Son constat de conflit sur `5432` avec `dpc-db` reste vrai.
- Ce qu'on perd : l'inspection **manuelle** de l'image construite depuis les sources, que
  `compose.dev.yaml` offrait en un `up`. Le profil `release` inspecte l'image *publiée* ; pour
  l'image locale, `docker build` puis `docker run` — deux lignes du runbook, pas un service
  permanent.
- Prisme reçoit une allocation avant d'avoir un serveur. C'est délibéré : `apps/prisme-api` est un
  squelette, il n'y a rien à migrer, et la grille lui préexiste au lieu de lui être imposée après
  coup.
- Les valeurs changent partout : défauts du code, composes, template, `.env.example`, documentation
  publique. `7532` ne survit nulle part — pas de compatibilité ascendante, aucune boutique n'est
  déployée.
- Les scripts `docker:up` / `docker:down` / `docker:logs` sont supprimés : personne ne les appelait,
  ils ne raccourcissaient pas la commande qu'ils enveloppaient, et depuis la fusion ils masquaient
  le profil `release` en ne couvrant qu'un des deux usages. `scripts/docker-init.sh` part avec eux —
  mort (une seule mention, en commentaire) et faux : il générait la clé de chiffrement en `hex 32`,
  soit 48 octets une fois décodée, que le garde-fou de `env.ts` refuse (32 attendus).
