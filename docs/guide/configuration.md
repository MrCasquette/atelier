# Configuration

Cette page recense les variables d'environnement lues par Échoppe.

::: warning Avant la 1.0, elle n'est pas un inventaire garanti
Elle couvre ce qui est stable, et elle est tenue à la main — la surface bouge encore (identité,
stockage média, Redis). Une variable absente d'ici peut donc exister ; ce sont les fichiers
`.env.<produit>` du dépôt qui font foi pour le développement, parce qu'ils sont lus à l'exécution.
:::

Selon ce que vous faites, votre point de départ diffère :

| Vous… | Votre fichier |
|-------|---------------|
| hébergez une boutique | le `.env` écrit par `create-echoppe`, que vous éditez |
| développez le framework | `.env.echoppe`, déjà dans le dépôt — vos secrets vont dans `.env.echoppe.local` |

::: tip Rien à copier, rien à générer
Les défauts de développement sont **versionnés** : `.env.echoppe` porte des adresses locales qui
marchent telles quelles. Ce qui est propre à votre machine — et tout secret réel — va dans
`.env.echoppe.local`, ignoré par git, qui surcharge le premier ligne à ligne.

Vous n'avez pas à créer ce second fichier : une variable **déclarée vide** dans `.env.echoppe` est un
prérequis, et `bun run dev echoppe` le remplit au premier lancement quand sa valeur n'admet qu'un
tirage aléatoire — il écrit le fichier et vous le dit. Une variable qui exigerait un *choix* ferait
l'inverse : la commande refuserait de démarrer en la nommant, plutôt que d'inventer une réponse.
:::

::: warning Une clé générée est une clé de développement
Si vous la remplacez plus tard, les credentials de prestataires déjà saisis dans le dashboard
deviennent illisibles — ils sont chiffrés avec l'ancienne. En développement, le seed reconstruit
tout ; en production, la clé se conserve.
:::

::: info Il n'y a plus de `.env` à la racine
Il n'avait plus de lecteur : chaque produit a le sien, `.env.echoppe` et `.env.prisme`, et Docker
Compose lit celui du répertoire de sa pile, `infra/<produit>/`. Un `.env` recréé par habitude ne
serait lu par personne — il reste ignoré par git pour qu'il n'entre jamais dans l'historique.
:::

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

Cela vaut pour un **hébergement**. En développement, `bun run dev echoppe` la génère pour vous.
:::

## Réseau et URL

| Variable | Description | Défaut |
|----------|-------------|--------|
| `API_PORT` | Port publié sur l'hôte. Le port **interne** du conteneur vaut toujours `8100` | `8100` |
| `ADMIN_URL` | Où joindre le dashboard — liens d'invitation, redirections autorisées | `http://localhost:8100/-/admin` |
| `STORE_URL` | Origine de la boutique, pour le CORS et les liens absolus des e-mails | `http://localhost:3100` |
| `PUBLIC_API_URL` | Origine de l'API, lue par le front et par la CLI de contenu | — |
| `API_URL` | Repli de `PUBLIC_API_URL` pour la seule CLI de contenu, quand la variable publique n'est pas posée | — |

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
