# Échoppe

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

> Framework e-commerce pour artisans français.

> [!IMPORTANT]
> **Dépôt privé, usage personnel.** Le code source, les images Docker et la documentation
> ne sont pas distribués publiquement. Seuls trois paquets npm restent publics —
> `@echoppe/client`, `@mrcasquette/content` et `create-echoppe` — parce que les boutiques
> les consomment depuis leur propre dépôt. Aucune contribution externe n'est ouverte.

**Documentation** : `bun run docs:dev` · **API Docs** : http://localhost:7532/-/docs

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
      ADMIN_URL: http://localhost:7532/-/admin
      # === À MODIFIER ===
      ADMIN_EMAIL: admin@example.com        # Votre email
      ADMIN_PASSWORD: votre-mot-de-passe    # Votre mot de passe
      ENCRYPTION_KEY: votre-cle-ici         # Générer avec: openssl rand -base64 32
    ports:
      - '7532:7532'
    volumes:
      - echoppe-uploads:/app/uploads
    depends_on:
      db:
        condition: service_healthy


volumes:
  echoppe-data:
  echoppe-uploads:
```

L'API **crée et migre le schéma au démarrage** (plus de conteneur d'init séparé).
Renseignez `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ENCRYPTION_KEY`, puis `docker compose up -d`.

**URLs :**
- Admin : http://localhost:7532/-/admin
- API : http://localhost:7532
- API Docs : http://localhost:7532/-/docs (OpenAPI/Scalar)

> Redis n'est plus requis (rate-limit distribué optionnel via `REDIS_URL`).

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

# 2. Lancer PostgreSQL + Redis
docker compose up -d

# 3. Initialiser la DB
bun run db:push --force
bun run db:seed

# 4. Lancer le dev
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
│   ├── api/          # Backend Elysia (image Docker, migre au boot)
│   ├── admin/        # Dashboard Vue (image Docker)
│   └── store/        # Exemple de boutique Astro (non distribué en image)
├── packages/
│   ├── core/         # DB + Schema + migrations (drizzle/)
│   ├── shared/       # Types partagés
│   ├── content/      # DSL config-as-code (npm)
│   ├── client/       # SDK @echoppe/client (npm)
│   └── create-echoppe/ # CLI de scaffolding (npm)
└── docs/             # Documentation VitePress (locale)
```

> L'atelier héberge Échoppe (e-commerce) et accueillera **Prisme** (CMS léger). Les deux
> produits partageront des briques (`assets`, `auth`, `content`, `communication`) sans
> dépendre l'un de l'autre — chacun assemble son propre schéma et ses propres migrations.

## Built With

- [Bun](https://bun.sh/) - Runtime JavaScript ultra-rapide
- [Elysia](https://elysiajs.com/) - Framework web TypeScript avec OpenAPI
- [Drizzle ORM](https://orm.drizzle.team/) - ORM TypeScript type-safe
- [Vue 3](https://vuejs.org/) - Framework frontend pour le dashboard
- [Astro](https://astro.build/) - Framework pour la boutique (exemple + scaffolding)
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS utility-first
- [PostgreSQL](https://www.postgresql.org/) - Base de données relationnelle

## Suivi

Le travail ouvert vit dans [`BACKLOG.md`](BACKLOG.md) ; les décisions structurantes dans
[les ADR](docs-internal/adr/README.md). Pas d'Issues ni de Discussions : dépôt privé,
un seul mainteneur.

## Licence

[CeCILL v2.1](LICENSE) — compatible GNU GPL. Elle continue de régir les paquets npm
publiés ; le code source du dépôt, lui, n'est pas distribué.
