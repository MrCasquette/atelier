# create-echoppe

Scaffolde une **boutique Astro** connectée à une API Échoppe,
prête à démarrer, via le SDK [`@echoppe/client`](https://www.npmjs.com/package/@echoppe/client).

## Utilisation

```bash
npm create echoppe@latest
# ou
bunx create-echoppe
pnpm create echoppe
```

Le wizard demande :

1. le **nom du projet** (dossier créé dans le répertoire courant) ;
2. l'**URL de l'API** Échoppe (écrite dans `.env` → `PUBLIC_API_URL`).

Puis il génère un repo préconfiguré (front Astro + orchestration Docker du backend) :

```bash
cd ma-boutique
docker compose up -d   # backend : API + Admin + PostgreSQL
pnpm install
pnpm dev               # front Astro
```

## Ce qui est généré

Un repo autonome, hors du monorepo framework :

- **`compose.yaml`** — backend (API + Admin + PostgreSQL) via images publiées ;
  l'API crée et migre le schéma au démarrage.
- **`.env`** pré-rempli — ports, identifiants DB, URL de l'API, et une
  `ENCRYPTION_KEY` **générée automatiquement**. Seuls `ADMIN_EMAIL`/`ADMIN_PASSWORD`
  sont à renseigner.
- `src/pages/` — accueil, `/produits`, `/produits/[slug]`
- `src/lib/api.ts` — client `@echoppe/client` typé, pointé sur `PUBLIC_API_URL`
- `src/layouts/`, `src/components/` — mise en page et carte produit

Le front est **à vous** ; le backend reste une image que vous déployez et mettez à
jour (`docker compose pull`).

## Options non-interactives (CI)

```bash
create-echoppe ma-boutique --api http://localhost:7532 --yes
```

## Licence

[CeCILL v2.1](LICENSE) — compatible GNU GPL.
