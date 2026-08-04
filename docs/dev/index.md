# Architecture

Vue d'ensemble de l'architecture technique d'Échoppe.

## Monorepo

Le projet utilise un monorepo Bun avec la structure suivante :

```
echoppe/
├── apps/
│   ├── api/          # API REST (Elysia)
│   ├── admin/        # Dashboard (Vue 3)
│   └── store/        # Exemple de boutique (Astro)
├── packages/
│   ├── core/         # Base de données, schemas, migrations, utils
│   ├── shared/       # Types partagés
│   ├── client/       # SDK @echoppe/client (npm)
│   └── create-echoppe/ # CLI de scaffolding (npm)
└── docs/             # Documentation (VitePress)
```

## Stack technique

### API (`apps/echoppe-api`)

| Technologie | Usage |
|-------------|-------|
| [Bun](https://bun.sh/) | Runtime JavaScript |
| [Elysia](https://elysiajs.com/) | Framework web |
| [Drizzle ORM](https://orm.drizzle.team/) | ORM type-safe |
| [PostgreSQL](https://www.postgresql.org/) | Base de données |
| [Redis](https://redis.io/) | Cache / rate-limit distribué (optionnel) |

### Admin (`apps/echoppe-admin`)

| Technologie | Usage |
|-------------|-------|
| [Vue 3](https://vuejs.org/) | Framework UI |
| [Vite](https://vitejs.dev/) | Build tool |
| [Tailwind CSS 4](https://tailwindcss.com/) | Styling |
| [Eden](https://elysiajs.com/eden/overview) | Client API type-safe |

### Store (`apps/echoppe-store`)

Exemple de boutique — non distribué en image ; sert de base au scaffolding
`create-echoppe`.

| Technologie | Usage |
|-------------|-------|
| [Astro](https://astro.build/) | Framework SSR (adapter Node) |
| [@echoppe/client](https://www.npmjs.com/package/@echoppe/client) | SDK API typé |
| [Tailwind CSS 4](https://tailwindcss.com/) | Styling |

## Flux de données

```
┌─────────┐     ┌─────────┐     ┌──────────────┐
│  Admin  │────▶│   API   │◀────│    Store     │
│ (Vue 3) │     │(Elysia) │     │   (Astro)    │
└─────────┘     └────┬────┘     └──────────────┘
                     │
              ┌──────┴───────┐
              │              │
         ┌────▼─────┐  ┌─────▼──────────┐
         │PostgreSQL│  │ Redis (option) │
         └──────────┘  └────────────────┘
```

## Packages partagés

### `@echoppe/core`

- Schemas Drizzle (tables, relations)
- Connexion base de données
- Utilitaires (slugify, formatters)
- Constantes (permissions, statuts)

### `@echoppe/shared`

- Types TypeScript partagés
- Interfaces API

## Authentification

Deux systèmes d'authentification distincts :

### Admin
- Sessions stockées en base (table `user_session`)
- Cookie `echoppe_admin_session` (HTTP-only, Secure, SameSite=Strict)
- Durée : 7 jours avec refresh

### Store (Clients)
- Sessions stockées en base (table `customer_session`)
- Cookie `echoppe_customer_session`
- Durée : 7 jours avec refresh

## Permissions (RBAC)

Le système de permissions utilise :
- **Rôles** : groupes de permissions
- **Permissions** : actions sur ressources (ex: `products.create`)
- **Middleware** : vérifie les permissions à chaque requête

Voir [Authentification](/dev/auth) pour plus de détails.
