# Boutique Échoppe

Boutique e-commerce **Astro** (SSR) connectée à une API Échoppe
via le SDK [`@echoppe/client`](https://www.npmjs.com/package/@echoppe/client).

Générée avec `npm create echoppe@latest`. Ce repo contient **le front** (que vous
possédez et modifiez) ; le **backend** (API + Admin + base de données) tourne à côté
via Docker, à partir d'images publiées.

## Démarrage

```bash
# 1. Backend : API + Admin + PostgreSQL (l'API crée/migre le schéma au boot)
docker compose up -d

# 2. Compte propriétaire — e-mail et mot de passe demandés au terminal, jamais écrits
#    dans un fichier. Une seule fois : la commande refuse dès qu'un compte existe.
docker compose exec -it api ./api admin:create
#    → API    http://localhost:8100
#    → Admin  http://localhost:8100/-/admin

# 3. Front : dépendances puis dev
pnpm install
pnpm dev
#    → Boutique http://localhost:4321
```

Toutes les valeurs (ports, identifiants, version d'images) sont dans `.env` ;
`compose.yaml` les lit automatiquement.

## Pages

- `/` — accueil (produits à la une)
- `/produits` — liste des produits
- `/produits/[slug]` — fiche produit

Tout part de `src/` : `layouts/`, `components/`, `pages/`, et `lib/api.ts`
(client SDK typé). Étendez librement.

## Build & production (front)

```bash
pnpm build     # build SSR (adapter Node standalone)
pnpm start     # node ./dist/server/entry.mjs
```

## Mettre à jour le backend

```bash
docker compose pull   # récupère la dernière image (ECHOPPE_VERSION dans .env)
docker compose up -d  # l'API applique les nouvelles migrations au démarrage
```
