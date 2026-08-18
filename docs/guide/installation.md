# Installation

## Le plus simple : `create-echoppe`

Pour démarrer une boutique complète (front **Astro** + orchestration Docker du backend) :

```bash
npm create echoppe@latest
cd ma-boutique
docker compose up -d      # backend : API + Admin + PostgreSQL
pnpm install && pnpm dev  # front
```

La CLI génère un `compose.yaml` et un `.env` pré-remplis (avec une `ENCRYPTION_KEY`
générée). Voir le [guide de la CLI](https://www.npmjs.com/package/create-echoppe).

---

## Backend seul (Production)

Pour ne déployer que le backend (API + Admin), par exemple derrière votre propre
reverse proxy.

### 1. Créez un fichier `compose.yaml`

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

### 2. Modifiez les 3 valeurs obligatoires

Dans la section `api.environment`, modifiez :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `ADMIN_EMAIL` | Email du compte administrateur | `jean@maboutique.fr` |
| `ADMIN_PASSWORD` | Mot de passe (min. 8 caractères) | `MonSuperMotDePasse!` |
| `ENCRYPTION_KEY` | Clé de chiffrement AES-256 | Voir ci-dessous |

::: tip Générer la clé de chiffrement
```bash
openssl rand -base64 32
```
Copiez le résultat et collez-le comme valeur de `ENCRYPTION_KEY`.
:::

### 3. Lancez

```bash
docker compose up -d
```

::: info Premier démarrage
- L'API **crée et migre le schéma** au démarrage (plus de conteneur d'init séparé)
- Le compte admin est créé avec vos identifiants
- Les images sont téléchargées depuis Docker Hub
:::

### Accès aux services

| Service | URL |
|---------|-----|
| **Admin** | http://localhost:7532/-/admin |
| **API** | http://localhost:7532 |
| **API Docs** | http://localhost:7532/-/docs |

Le **front** (boutique) vit dans son propre repo — généré par `create-echoppe` — et
pointe sur l'API via `PUBLIC_API_URL`.

### Variables optionnelles

Pour changer les ports ou les URLs :

```yaml
environment:
  ADMIN_URL: https://admin.maboutique.fr   # URL publique de l'admin
  STORE_URL: https://maboutique.fr         # URL publique du front (CORS)
ports:
  - '8080:7532'  # Changer le port exposé
```

::: tip Redis (optionnel)
Le rate-limit distribué s'active en fournissant `REDIS_URL` à l'`api` (sinon il se
dégrade sans erreur). Non requis pour un déploiement standard.
:::

### Mise à jour

```bash
docker compose pull   # dernière image
docker compose up -d  # l'API applique les nouvelles migrations au démarrage
```

---

## Installation développement

### Prérequis

- [Bun](https://bun.sh/) >= 1.0
- [Docker](https://www.docker.com/) et Docker Compose

### Étapes

```bash
# 1. Cloner le projet
git clone git@github.com:MrCasquette/atelier.git
cd atelier

# 2. Installer les dépendances
bun install

# 3. Copier la configuration
cp .env.example .env

# 4. Lancer PostgreSQL (compose de dev : Postgres exposé sur 5432)
docker compose -f compose.dev.yaml up -d postgres

# 5. Initialiser la base de données
bun run db:push --force
bun run db:seed

# 6. Lancer en développement
bun run dev
```

**Login dev :** `admin@echoppe.dev` / `admin123`

### Commandes utiles

```bash
# Développement
bun run dev              # Lancer tous les services
bun run dev:api          # API seule
bun run dev:admin        # Admin seul
bun run dev:store        # Exemple Astro seul

# Base de données
bun run db:push --force  # Appliquer le schéma (itération dev)
bun run db:generate      # Générer une migration SQL après un changement de schéma
bun run db:seed          # Données de test
bun run db:studio        # Interface Drizzle Studio
```

::: info Migrations
En dev on itère avec `db:push`. Quand un changement de schéma est prêt,
`bun run db:generate` crée la migration SQL versionnée (à **committer**) : l'image
`api` l'applique automatiquement au démarrage chez les selfhosters.
:::

## Structure du projet

```
echoppe/
├── apps/
│   ├── api/          # API Elysia (image Docker, migre au boot)
│   ├── admin/        # Dashboard Vue 3 (image Docker)
│   └── store/        # Exemple de boutique Astro (non distribué en image)
├── packages/
│   ├── core/         # DB, schemas, migrations (drizzle/), utils
│   ├── shared/       # Types partagés
│   ├── client/       # SDK @echoppe/client (npm)
│   └── create-echoppe/ # CLI de scaffolding (npm)
├── docs/             # Cette documentation
└── uploads/          # Fichiers uploadés
```
