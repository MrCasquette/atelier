# atelier

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Elysia](https://img.shields.io/badge/Elysia-F4339A?logoUrl=https://elysiajs.com/assets/elysia.svg&logoColor=white)
![Vue](https://img.shields.io/badge/Vue.js-31465B?logo=vuedotjs&logoColor=3DB27F)
![Astro](https://img.shields.io/badge/Astro-000000?logo=astro&logoColor=FF5D00)
![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?logo=drizzle&logoColor=000000)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-FFFFFF?logo=tailwind-css&logoColor=34B7F1)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?logo=github-actions&logoColor=white)

> Le workspace de deux produits frères.

## Deux produits frères

`atelier` n'est pas un produit : c'est le dépôt qui en héberge deux, et **aucun des deux n'est le
principal**.

| Produit | Ce que c'est | Applications |
|---|---|---|
| **Échoppe** | framework e-commerce pour artisans français | `apps/echoppe-api`, `apps/echoppe-admin`, `apps/echoppe-store` |
| **Prisme** | CMS headless config-as-code | `apps/prisme-api`, `apps/prisme-admin` |

Ils partagent des capacités par les paquets `@repo/*` — jamais par l'autre produit. Échoppe ne
dépend pas de Prisme, et réciproquement : chacun assemble son propre schéma et ses propres
migrations. Cette frontière est gardée par `bun run product-isolation`, qui refuse toute dépendance
croisée, déclarée **ou seulement importée**.

Échoppe est le seul produit installable aujourd'hui ; Prisme n'a pas encore de surface publiée. Tout
le démarrage rapide ci-dessous concerne donc Échoppe.

> [!IMPORTANT]
> **Dépôt privé, usage personnel.** Le code source, les images Docker et la documentation
> ne sont pas distribués publiquement. Seuls trois paquets npm restent publics —
> `@echoppe/client`, `@mrcasquette/content` et `create-echoppe` — parce que les boutiques
> les consomment depuis leur propre dépôt. Aucune contribution externe n'est ouverte.

**Documentation** : `bun run docs:dev` · **API Docs** : http://localhost:8100/-/docs

## Démarrage rapide

### Le plus simple : `create-echoppe`

Scaffolde un projet complet — front **Astro** + orchestration Docker du backend :

```bash
# Les images sont privées : s'authentifier une fois sur l'hôte.
# PAT dédié portant `read:packages` et rien d'autre.
echo "$GHCR_TOKEN" | docker login ghcr.io -u mrcasquette --password-stdin

npm create echoppe@latest
cd ma-boutique
docker compose up -d      # backend : API + Admin + PostgreSQL
pnpm install && pnpm dev  # front
```

### Backend seul (Docker)

Pour ne déployer que le backend (API + Admin), un `compose.yaml` minimal :

```yaml
services:
  db:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: echoppe
      POSTGRES_PASSWORD: echoppe
      POSTGRES_DB: echoppe
    volumes:
      - echoppe-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U echoppe -d echoppe']
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    image: ghcr.io/mrcasquette/echoppe-api:latest
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://echoppe:echoppe@db:5432/echoppe
      ADMIN_URL: http://localhost:8100/-/admin
      # === À MODIFIER ===
      ENCRYPTION_KEY: votre-cle-ici         # Générer avec: openssl rand -base64 32
    ports:
      - '8100:8100'
    volumes:
      - echoppe-uploads:/data
    depends_on:
      db:
        condition: service_healthy


volumes:
  echoppe-data:
  echoppe-uploads:
```

L'API **crée et migre le schéma au démarrage** (plus de conteneur d'init séparé).
Renseignez `ENCRYPTION_KEY`, puis :

```bash
docker compose up -d
docker compose exec -it api ./api admin:create   # e-mail + mot de passe demandés
```

Aucun compte ne naît d'une variable d'environnement : le mot de passe du propriétaire ne transite
par aucun fichier.

**URLs :**
- Admin : http://localhost:8100/-/admin
- API : http://localhost:8100
- API Docs : http://localhost:8100/-/docs (OpenAPI/Scalar)

> [!WARNING]
> Redis n'est pas requis au démarrage, mais son absence n'est pas neutre : le rate-limit **n'a
> aucun repli en mémoire** — sans `REDIS_URL`, il ne limite rien
> ([`rate-limit.ts`](apps/echoppe-api/src/lib/rate-limit.ts)). Le repli est un chantier ouvert ;
> d'ici là, une exposition publique veut Redis.

---

## Développement

### Prérequis

- [Bun](https://bun.sh/) 1.0+
- [Docker](https://docker.com/)

### Installation

```bash
# 1. Cloner et installer
git clone git@github.com:MrCasquette/atelier.git
cd atelier
bun install

# 2. Configurer — l'API refuse de démarrer sans ENCRYPTION_KEY
cp .env.example .env
openssl rand -base64 32   # à coller dans ENCRYPTION_KEY

# 3. Lancer PostgreSQL + Redis
docker compose up -d

# 4. Initialiser la DB
bun run db:push
bun run db:seed

# 5. Lancer le dev
bun run dev
```

**Login dev :** `admin@echoppe.dev` / `admin123`

### Scripts

| Commande | Description |
|----------|-------------|
| `bun run dev` | Lance API + Dashboard + exemple Astro |
| `bun run db:push` | Push schema vers DB (itération dev) |
| `bun run db:generate` | Génère une migration SQL après un changement de `schema/` |
| `bun run db:seed` | Seed données de base |
| `bun run db:studio` | Interface Drizzle Studio |

> **Migrations** : en dev on itère avec `db:push`. Quand un changement de schéma est
> prêt, `bun run db:generate` crée la migration SQL versionnée (à **committer**) —
> l'image `api` l'applique automatiquement au démarrage chez les selfhosters.

## Structure

```
atelier/
├── apps/
│   ├── echoppe-api/      # Backend Elysia — sert aussi le dashboard, migre au boot
│   ├── echoppe-admin/    # Dashboard Vue, servi par l'API sous /-/admin
│   ├── echoppe-store/    # Exemple de boutique Astro (non distribué en image)
│   ├── prisme-api/       # Backend Prisme
│   └── prisme-admin/     # Dashboard Prisme
├── packages/
│   ├── echoppe-core/     # Le core d'Échoppe : possède la base et ses migrations
│   ├── echoppe-client/   # SDK typé de l'API Échoppe          → npm
│   ├── content/          # DSL config-as-code d'Échoppe       → npm @mrcasquette/content
│   ├── create-echoppe/   # CLI de scaffolding d'une boutique  → npm
│   ├── create-prisme/    # CLI de scaffolding Prisme
│   └── …                 # briques communes @repo/* (voir ci-dessous)
├── docs/                 # Documentation publique (VitePress)
├── docs-internal/        # ADR, backlogs, références, notes de chantier
└── scripts/              # Outillage racine et gardes
```

**Les briques communes** — paquets `@repo/*`, privés, consommés par les deux produits. Chacune
porte sa charte dans son propre `README.md` :

| Paquet | Ce qu'il livre |
|---|---|
| `db` | connexion applicative, runner de migrations |
| `shared` | chiffrement symétrique des secrets, et un second utilitaire sans état |
| `auth` | authentification d'administration, registre de principaux, règles de droits |
| `identity` | tables `site`, `legalEntity`, `country` |
| `assets` | tables `media` et `folder` |
| `communication` | providers d'envoi (Resend, Brevo, SMTP), gabarits, configuration |
| `adapters` | ce qui se répétait à l'identique entre paiement, livraison et communication |
| `fields` | ce qu'un champ est, et ce qu'il accepte |
| `references` | le socle des cibles référençables |
| `pages` | registre de definitions (`section`, `component`) |
| `menus` | liens ordonnés vers ce que le registre déclare |
| `entities` | l'entité comme donnée, indépendante du CMS |

## Built With

- [Bun](https://bun.sh/) - Runtime JavaScript ultra-rapide
- [Elysia](https://elysiajs.com/) - Framework web TypeScript avec OpenAPI
- [Drizzle ORM](https://orm.drizzle.team/) - ORM TypeScript type-safe
- [Vue 3](https://vuejs.org/) - Framework frontend pour le dashboard
- [Astro](https://astro.build/) - Framework pour la boutique (exemple + scaffolding)
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS utility-first
- [PostgreSQL](https://www.postgresql.org/) - Base de données relationnelle

## Suivi

Le travail ouvert vit dans [`BACKLOG.md`](BACKLOG.md), ce qui vient après la V1 dans
[`ROADMAP.md`](ROADMAP.md), et les décisions structurantes dans
[les ADR](docs-internal/adr/README.md). Les conventions de code sont dans
[`docs-internal/reference/conventions.md`](docs-internal/reference/conventions.md), et le manuel
d'opération destiné aux agents dans [`AGENTS.md`](AGENTS.md).

Pas d'Issues ni de Discussions : dépôt privé, un seul mainteneur.

## Licence

[CeCILL v2.1](LICENSE) — compatible GNU GPL. Elle continue de régir les paquets npm
publiés ; le code source du dépôt, lui, n'est pas distribué.
