# Mise à jour

Comment mettre à jour une boutique Échoppe (le backend : API + Admin), et ce à quoi
faire attention.

## Ce qui se met à jour, et comment

Le **backend** (API + Admin) est distribué en **images Docker**. Le **front** de votre
boutique est votre propre code : il n'est jamais écrasé par une mise à jour.

Mettre à jour le backend = récupérer les nouvelles images puis recréer les conteneurs :

```bash
docker compose pull      # télécharge les nouvelles images
docker compose up -d      # recrée les conteneurs avec les nouvelles images
```

::: tip L'API migre toute seule
Au démarrage, l'API applique automatiquement les **migrations SQL** en attente
(`RUN_MIGRATIONS`). Aucune commande de migration manuelle à lancer : `up -d` suffit.
:::

::: warning `pull` seul ne suffit pas
`docker compose pull` ne fait que télécharger. Sans `docker compose up -d`, les
conteneurs continuent de tourner sur l'ancienne image.
:::

## Épinglez la version (recommandé en production)

Par défaut, `create-echoppe` écrit `ECHOPPE_VERSION=latest` dans `.env`. Pratique, mais
un `pull` vous fait alors sauter sur la dernière version **sans que vous choisissiez le
moment**. En production, épinglez une version précise :

```dotenv
# .env
ECHOPPE_VERSION=0.1.0
```

Pour mettre à jour, bumpez ce numéro **vous-même** (après avoir lu le changelog de la
version cible), puis :

```bash
docker compose pull
docker compose up -d
```

Vous maîtrisez ainsi quand et vers quelle version vous montez.

## Gardez le SDK du front en phase

Le front interroge l'API via le SDK [`@axiome-apps/echoppe-client`](https://www.npmjs.com/package/@axiome-apps/echoppe-client).
Si une mise à jour modifie le **contrat de l'API** (une route, un champ), alignez le SDK :

```bash
pnpm update @axiome-apps/echoppe-client
```

- **Patch / mineur** (`0.1.x` → `0.1.y`, `0.1` → `0.2`) : généralement compatible.
- **Majeur** (`0.x` → `1.0`, `1.x` → `2.0`) : coordonnez l'image **et** le SDK, et
  adaptez éventuellement votre code front. La version du SDK suit celle de l'API.

## Sauvegardez avant un saut majeur

Les migrations sont **forward-only** : il n'y a pas de rollback propre du schéma.

- Remettre une ancienne image **après** qu'une migration a tourné ne défait pas le
  changement de schéma.
- **Avant une montée de version majeure**, faites une sauvegarde de la base :

```bash
docker compose exec db pg_dump -U echoppe echoppe > backup-$(date +%F).sql
```

## En résumé

| Type de mise à jour | Procédure |
|---|---|
| **Patch / mineur** | `docker compose pull && docker compose up -d` (l'API migre seule) |
| **Majeur** | Backup DB → bump `ECHOPPE_VERSION` → `pull && up -d` → `pnpm update @axiome-apps/echoppe-client` → vérifier le front |
