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

### 2. Renseignez la clé de chiffrement

Dans la section `api.environment` :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `ENCRYPTION_KEY` | Clé de chiffrement AES-256 | Voir ci-dessous |

Le compte administrateur, lui, ne se configure pas ici : il se crée après le démarrage (étape 4),
pour qu'aucun mot de passe ne soit écrit dans un fichier.

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
- Les images sont téléchargées depuis Docker Hub
- Aucun compte n'existe encore : les journaux vous le rappellent
:::

### 4. Créez le compte propriétaire

```bash
docker compose exec -it api ./api admin:create
```

La commande demande l'e-mail et le mot de passe, et n'accepte rien d'autre : pas d'option en ligne
de commande, pas de lecture sur l'entrée standard. Le mot de passe n'apparaît donc ni à l'écran, ni
dans l'historique du shell, ni dans un fichier de configuration — il ne quitte le terminal que sous
forme d'empreinte Argon2id.

Ce compte est le **propriétaire** de l'installation. Il n'y en a qu'un, et il peut transmettre sa
propriété à un autre administrateur depuis l'administration. Les comptes suivants se créent par
invitation, où le créateur ne connaît jamais le mot de passe.

::: warning Une seule fois
`admin:create` refuse de s'exécuter dès qu'un compte existe. Un mot de passe oublié se réinitialise
depuis l'administration, pas en relançant la commande.
:::

### Accès aux services

| Service | URL |
|---------|-----|
| **Admin** | http://localhost:8100/-/admin |
| **API** | http://localhost:8100 |
| **API Docs** | http://localhost:8100/-/docs |

Le **front** (boutique) vit dans son propre repo — généré par `create-echoppe` — et
pointe sur l'API via `PUBLIC_API_URL`.

### Variables optionnelles

Pour changer les ports ou les URLs :

```yaml
environment:
  ADMIN_URL: https://admin.maboutique.fr   # URL publique de l'admin
  STORE_URL: https://maboutique.fr         # URL publique du front (CORS)
ports:
  - '8080:8100'  # Changer le port exposé
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

# 3. Le seul secret requis (les défauts sont déjà versionnés dans .env.echoppe)
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env.echoppe.local

# 4. Lancer — la pile Postgres/Redis, les migrations, le seed, puis les surfaces
bun run dev echoppe
```

**Login dev :** `admin@echoppe.dev` / `admin123`

### Commandes utiles

Le dépôt héberge deux produits frères, et aucun n'est tacite : **ce qui exécute un produit le
nomme**. Sans produit, la commande refuse et liste ceux qu'elle a découverts.

```bash
# Développement
bun run dev echoppe          # Tout : pile, migrations, données de dev, surfaces
bun run dev echoppe api      # Une surface seule — la base monte quand même
bun run dev echoppe admin
bun run dev echoppe store

# Base de données
bun run db echoppe push      # Appliquer le schéma (itération dev)
bun run db echoppe generate  # Générer une migration SQL après un changement de schéma
bun run db echoppe seed      # Données de test
bun run db echoppe studio    # Interface Drizzle Studio

# Infrastructure — passe la main à `docker compose`, dans infra/echoppe/
bun run infra echoppe ps
bun run infra echoppe down
```

::: info Migrations
En dev on itère avec `db <produit> push`, qui ne fait **jamais** partie de `dev` : sur une base qui
porte des entités, il détruit leurs tables. Quand un changement de schéma est prêt,
`bun run db echoppe generate` crée la migration SQL versionnée (à **committer**) : l'image `api`
l'applique automatiquement au démarrage chez les selfhosters.
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
│   ├── client/       # SDK @axiome-apps/echoppe-client (npm)
│   └── create-echoppe/ # CLI de scaffolding (npm)
├── docs/             # Cette documentation
└── uploads/          # Fichiers uploadés
```
