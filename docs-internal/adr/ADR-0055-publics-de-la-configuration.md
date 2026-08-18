# ADR-0055 — Trois publics de la configuration, un fichier chacun

Statut : accepté · 2026-08-18
Portée : socle

## Contexte

La configuration du dépôt s'était accumulée sans que personne ne désigne son destinataire. Quatre
fichiers coexistaient, et l'un d'eux ne savait plus à qui il parlait : `.env.example` racine
annonçait « Copy this file to .env » en portant `POSTGRES_PASSWORD`, `DOCKER_REGISTRY`,
`ADMIN_EMAIL` — la configuration d'un hébergement que ce fichier ne sert pas à faire, puisqu'une
boutique reçoit le sien via `create-echoppe`.

Trois constats l'ont rendu intenable.

**Deux `.env` jumeaux.** `.env` racine et `apps/echoppe-api/.env` étaient identiques octet pour
octet — une copie maintenue deux fois, pas une spécialisation.

**Un chargement incohérent dans un même fichier.** `apps/echoppe-api/package.json` faisait lire
`.env` local à `dev`, et `../../.env` à `start` et `api-key:create`. Tant que les deux fichiers sont
jumeaux, rien ne se voit ; le jour où l'un diverge, la clé d'API créée n'existe pas dans la base que
l'API interroge. Panne silencieuse, du même genre que la régression du gate corrigée la veille.

**Un parcours de contribution cassé.** Le README décrit cloner, installer, monter l'infra, `db:push`,
`dev` — sans jamais mentionner le `.env`. Un fork qui suit la documentation à la lettre bute à
l'étape 3. Le garde-fou d'`env.ts` refuse le boot avec un message clair, mais rien ne dit quel
fichier copier. C'est ce constat qui a nommé le public manquant : celui qui développe le framework
sans le connaître.

**Des variables fantômes.** `STRIPE_*`, `PAYPAL_*`, `SMTP_*`, `RESEND_API_KEY`, `BREVO_API_KEY`
n'étaient lues **nulle part** — les credentials d'un fournisseur vivent en base, chiffrés
(ADR-0011, `credential-store.ts`), et se saisissent dans le dashboard. Les renseigner n'a jamais eu
d'effet.

## Options envisagées

- **Un fichier de référence exhaustif** — un seul endroit répond à « quelles variables existent »,
  mais il continue de décrire un déploiement qu'il ne sert pas à faire, ce qui est précisément la
  confusion qu'on répare.
- **Supprimer le `.env.example` racine** — rien à maintenir en double, mais un poste neuf part d'une
  page blanche alors que c'est son seul point d'entrée.
- **Un fichier par public, chacun minimal.**

## Décision

### Les trois publics

| Public | Ce qu'il fait | Son fichier |
|--------|---------------|-------------|
| **Contributeur** | développe le framework | `.env.example` racine |
| **Intégrateur** | construit une boutique | `template/.env.example`, puis le `.env` généré par la CLI |
| **Exploitant** | héberge la boutique | le `.env` généré, qu'il édite |

L'exploitant n'a pas de fichier à lui : il reçoit celui que `create-echoppe` a écrit, clé de
chiffrement déjà tirée au sort. Un `.env.example` de production n'existe donc pas — ce qu'on livre
est un `.env` réel dès sa création, dont les valeurs d'exemple sont éditables.

« Contributeur » remplace « moi » : le fichier n'a aucune valeur pour qui a déjà son `.env`, et
toute sa valeur pour qui découvre le dépôt.

### Un seul `.env` dans le dépôt

`apps/echoppe-api/.env` est supprimé. Tous les scripts lisent la racine par `--env-file=../../.env`,
sans exception. Bun ne remonte pas l'arborescence — un `.env` n'est lu que depuis le cwd — donc
cette énumération explicite est la condition d'un fichier unique, pas une redondance à supprimer.

### Le `.env.example` du contributeur ne porte que ce qu'il faut pour démarrer

Les clés d'hébergement partent : elles décrivent le travail de l'exploitant, et le template les
porte déjà. Les clés fournisseurs partent aussi, parce qu'elles ne sont lues par personne — un
fichier de configuration qui liste des variables sans effet coûte plus qu'il n'apporte.

Ce qui reste optionnel mais réel est documenté dans `docs/guide/configuration.md`, qui devient la
référence des variables.

## Conséquences

- Le README gagne l'étape manquante : copier `.env.example` avant de monter quoi que ce soit.
- `docs/guide/configuration.md` doit couvrir les variables réellement lues par le code, y compris
  celles qu'aucun fichier ne mentionnait (`UPLOAD_DIR`, `SHOP_NAME`, `MIGRATIONS_DIR`,
  `DASHBOARD_DIR`, `RUN_MIGRATIONS`) et celles des harnais (`SMOKE_*`, `INTEGRATION_IMAGE`,
  `PREV_IMAGE`, `CONTRACT_API_URL`).
- Cette référence peut diverger du code sans que rien ne le signale. C'est la dette assumée du
  fichier minimal. Elle se tiendra par une garde de découverte plutôt que par la discipline — même
  idiome que `drift-guard`, `product-isolation` et `reserved-space` — mais **pas maintenant** : la
  surface des variables bouge encore (identité/OIDC, stockage média, Redis), et une garde écrite
  aujourd'hui figerait une nomenclature en cours de remaniement. Inscrite au backlog `shared.md`.
- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` restent dans le fichier du contributeur bien
  qu'aucun code ne les lise : c'est `compose.yaml` qui les consomme, et il en a besoin.
