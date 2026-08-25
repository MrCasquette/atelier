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
> `@axiome-apps/echoppe-client`, `@axiome-apps/atelier-content` et `create-echoppe` — parce que les boutiques
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

# 2. Configurer — rien à copier, les défauts sont versionnés (.env.echoppe).
#    Seul secret requis : l'API refuse de démarrer sans ENCRYPTION_KEY.
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env.echoppe.local

# 3. Lancer — la pile, les migrations, les données de dev, puis les surfaces
bun run dev echoppe
```

**Login dev :** `admin@echoppe.dev` / `admin123`

### Les commandes

Ce qui **exécute** un produit le nomme ; ce qui **vérifie** le dépôt n'en nomme aucun
([ADR-0066](docs-internal/adr/ADR-0066-ce-qui-execute-nomme-son-produit.md)). Le dépôt héberge deux
produits frères, et il n'y en a pas de tacite.

| Commande | Description |
|----------|-------------|
| `bun run dev <produit>` | La pile, les migrations, le seed, puis toutes les surfaces |
| `bun run dev <produit> api` | Une surface seule — la pile et la base montent quand même |
| `bun run db <produit> <verbe>` | `generate`, `migrate`, `push`, `seed`, `studio` selon le produit |
| `bun run infra <produit> <…>` | Passe la main à `docker compose`, dans `infra/<produit>/` |
| `bun run integration <produit> <suite>` | `api` (Postgres jetable) ou `image` (l'artefact publié) |
| `bun run lint` · `type-check` · `test` | Sans produit : ils vérifient le dépôt entier |

Sans produit, ces commandes **refusent et listent** ce que le dépôt connaît. Elles le découvrent —
aucune liste de produits n'est écrite nulle part.

> **Migrations** : en dev on itère avec `bun run db <produit> push`, qui ne fait jamais partie de
> `dev` — sur une base qui porte des entités, il détruit leurs tables. Quand un changement de schéma
> est prêt, `bun run db <produit> generate` crée la migration SQL versionnée (à **committer**) —
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
│   ├── content/          # DSL config-as-code d'Échoppe       → npm @axiome-apps/atelier-content
│   ├── create-echoppe/   # CLI de scaffolding d'une boutique  → npm
│   ├── create-prisme/    # CLI de scaffolding Prisme
│   └── …                 # briques communes @repo/* (voir ci-dessous)
├── docs/                 # Documentation publique (VitePress)
├── docs-internal/        # ADR, architecture, conventions, glossaire, runbook, backlogs
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
[`ROADMAP.md`](ROADMAP.md).

La documentation interne a cinq natures, et une seule question mène à chacune
([ADR-0060](docs-internal/adr/ADR-0060-natures-de-la-documentation.md)) : comment le système est fait
aujourd'hui → [`architecture/`](docs-internal/architecture/overview.md) · pourquoi il l'est →
[les ADR](docs-internal/adr/README.md) · comment on écrit du code ici →
[`conventions.md`](docs-internal/conventions.md) · ce qu'un mot veut dire →
[`glossaire.md`](docs-internal/glossaire.md) · comment on publie et exploite →
[`runbook/`](docs-internal/runbook/pipeline-release.md).

Le manuel d'opération destiné aux agents est [`AGENTS.md`](AGENTS.md).

Pas d'Issues ni de Discussions : dépôt privé, un seul mainteneur.

## Licence

[CeCILL v2.1](LICENSE) — compatible GNU GPL. Elle continue de régir les paquets npm
publiés ; le code source du dépôt, lui, n'est pas distribué.
