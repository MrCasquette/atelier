# Configuration

Cette page est la **référence des variables d'environnement** réellement lues par Échoppe. Elle
suit le code : une variable qui n'y figure pas n'a aucun effet.

Selon ce que vous faites, votre point de départ diffère :

| Vous… | Votre fichier |
|-------|---------------|
| hébergez une boutique | le `.env` écrit par `create-echoppe`, que vous éditez |
| développez le framework | `cp .env.example .env` à la racine du dépôt |

::: tip Les credentials des prestataires ne sont pas ici
Stripe, PayPal, SMTP, Colissimo, Sendcloud… se configurent **dans le dashboard**, sous
« Prestataires ». Ils sont stockés chiffrés en base — aucune variable d'environnement ne les porte,
et en définir une n'aurait aucun effet.
:::

## Requis

L'API refuse de démarrer sans ces variables, et affiche laquelle manque.

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | Connexion PostgreSQL | — |
| `ENCRYPTION_KEY` | Clé de chiffrement des credentials — 32 octets en base64 | — |

::: warning Conservez `ENCRYPTION_KEY`
Elle chiffre les credentials de vos prestataires. La perdre oblige à tous les ressaisir : les
valeurs stockées deviennent illisibles. Générez-la avec `openssl rand -base64 32`.
:::

## Réseau et URL

| Variable | Description | Défaut |
|----------|-------------|--------|
| `API_PORT` | Port publié sur l'hôte. Le port **interne** du conteneur vaut toujours `8100` | `8100` |
| `ADMIN_URL` | Où joindre le dashboard — liens d'invitation, redirections autorisées | `http://localhost:8100/-/admin` |
| `STORE_URL` | Origine de la boutique, pour le CORS et les liens absolus des e-mails | `http://localhost:3100` |
| `PUBLIC_API_URL` | Origine de l'API, lue par le front et par la CLI de contenu | — |

## Fonctionnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `REDIS_URL` | Active le rate-limit distribué. Sans elle, l'API fonctionne, en dégradation silencieuse | — |
| `UPLOAD_DIR` | Où sont écrits les fichiers téléversés | `apps/echoppe-api/uploads` · `/data/uploads` en image |
| `SHOP_NAME` | Nom de la boutique affiché par PayPal au paiement | `Shop` |
| `NODE_ENV` | `production` durcit les cookies (`secure`) et les en-têtes de sécurité | — |

## Premier démarrage

Le compte propriétaire n'est **pas** une variable : il se crée après le démarrage, par
`docker compose exec -it api ./api admin:create`, qui demande e-mail et mot de passe au terminal.
Aucun secret de compte ne vit donc dans un fichier de configuration.

| Variable | Description | Défaut |
|----------|-------------|--------|
| `RUN_MIGRATIONS` | Applique les migrations au démarrage. Défini dans l'image publiée, absent en développement | — |
| `MIGRATIONS_DIR` | Où trouver les migrations SQL | déduit du binaire |
| `DASHBOARD_DIR` | Où trouver le dashboard compilé, servi sous `/-/admin` | déduit du binaire |

## Outillage du contributeur

Ces variables ne servent qu'aux scripts du dépôt et n'ont pas leur place dans un `.env`.

| Variable | Description |
|----------|-------------|
| `CONTRACT_API_URL` | API dont le SDK est régénéré (`bun run contracts`) — défaut : l'API des sources |
| `DISPOSABLE_DB` · `TEST_DATABASE_URL` | Attestent qu'une base peut être détruite, et laquelle. Sans le drapeau, `test:api` refuse de tourner |
| `INTEGRATION_IMAGE` · `PREV_IMAGE` | Réutilisent une image déjà construite, et désignent l'image n-1 du test d'upgrade |

## CLI de contenu

Lues par `@axiome-apps/atelier-content` (`content push` / `content check`).

| Variable | Description |
|----------|-------------|
| `CONTENT_API_KEY` | Clé d'API machine, portée `write:schema`, créée dans le dashboard |
| `CONTENT_CONFIG` | Chemin du fichier de définitions, si vous ne suivez pas la convention |

## Ce qui ne se configure pas par l'environnement

**Les ports des piles de développement.** Chaque pile porte son rang en dur, dans le fichier qui la
définit — l'API des sources sur `8101`, le dashboard Vite sur `3110`, la vitrine sur `3100`. Seul
`API_PORT` reste à vous : il déplace le port publié sur l'hôte.

**Les credentials des prestataires**, comme rappelé plus haut : dashboard, section « Prestataires ».
