# Échoppe - Monorepo Dockerfile (Optimized)
# Build targets: api, admin
#
# Usage:
#   docker build --target api -t echoppe/api .
#   docker build --target admin --build-arg VITE_API_URL=https://api.example.com -t echoppe/admin .
#
# L'API applique les migrations SQL versionnées au démarrage (RUN_MIGRATIONS=1,
# dossier /app/drizzle) : plus de conteneur d'init séparé.
#
# NB : apps/echoppe-store (exemple Astro) n'est pas distribué en image Docker. C'est un
# template de référence exécuté localement (bun dev/build) ou servi de base au
# scaffolding create-echoppe ; les vraies boutiques vivent dans leur propre repo.

# ==============================================================================
# Base stage
# ==============================================================================
FROM oven/bun:1-alpine AS base
WORKDIR /app

# ==============================================================================
# Dependencies stage (all deps for build)
# ==============================================================================
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/
COPY packages/assets/package.json ./packages/assets/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY packages/adapters/package.json ./packages/adapters/
COPY packages/identity/package.json ./packages/identity/
COPY packages/pages/package.json ./packages/pages/
COPY packages/references/package.json ./packages/references/
COPY packages/communication/package.json ./packages/communication/
COPY packages/client/package.json ./packages/client/
COPY packages/content/package.json ./packages/content/
COPY packages/create-echoppe/package.json ./packages/create-echoppe/
COPY apps/echoppe-api/package.json ./apps/echoppe-api/
COPY apps/echoppe-admin/package.json ./apps/echoppe-admin/
COPY apps/echoppe-store/package.json ./apps/echoppe-store/
COPY docs/package.json ./docs/
RUN bun install --frozen-lockfile

# ==============================================================================
# Source stage (shared)
# ==============================================================================
FROM base AS source
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/assets/node_modules ./packages/assets/node_modules
COPY --from=deps /app/packages/auth/node_modules ./packages/auth/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/adapters/node_modules ./packages/adapters/node_modules
COPY --from=deps /app/packages/identity/node_modules ./packages/identity/node_modules
COPY --from=deps /app/packages/pages/node_modules ./packages/pages/node_modules
COPY --from=deps /app/packages/references/node_modules ./packages/references/node_modules
COPY --from=deps /app/packages/communication/node_modules ./packages/communication/node_modules
COPY --from=deps /app/apps/echoppe-api/node_modules ./apps/echoppe-api/node_modules
COPY --from=deps /app/apps/echoppe-admin/node_modules ./apps/echoppe-admin/node_modules
COPY --from=deps /app/apps/echoppe-store/node_modules ./apps/echoppe-store/node_modules
COPY --from=deps /app/docs/node_modules ./docs/node_modules
COPY . .

# ==============================================================================
# API (compiled binary - no node_modules needed)
# ==============================================================================
FROM source AS api-builder
# PAS de --minify : Elysia analyse le SOURCE des handlers/macros (Sucrose) pour n'injecter
# dans le contexte que les propriétés réellement utilisées (headers, cookie…). La minification
# renomme les paramètres déstructurés → l'analyse échoue → `headers` non injecté (undefined) →
# 500 sur toute route protégée par RBAC. Bug invisible en dev (TS interprété), fatal en binaire.
RUN bun build src/index.ts \
    --compile \
    --sourcemap=none \
    --outfile api \
    --target bun \
    --cwd apps/echoppe-api

FROM oven/bun:1-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads
# Migrations SQL versionnées appliquées au boot par l'API elle-même.
ENV RUN_MIGRATIONS=1
ENV MIGRATIONS_DIR=/app/drizzle

RUN addgroup -g 1001 -S echoppe && \
    adduser -S echoppe -u 1001

COPY --from=api-builder --chown=echoppe:echoppe /app/apps/echoppe-api/api ./api
COPY --chown=echoppe:echoppe packages/core/drizzle ./drizzle

RUN mkdir -p /app/uploads && chown -R echoppe:echoppe /app/uploads

USER echoppe
EXPOSE 7532

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:7532/health || exit 1

CMD ["./api"]

# ==============================================================================
# Admin Dashboard
# ==============================================================================
# L'admin est un site STATIQUE (l'image finale est caddy servant dist/). Le build vite sous
# émulation QEMU arm64 est ~70× plus lent (~4 min) pour un résultat arch-indépendant : l'image
# admin est donc construite en amd64 uniquement (cf. docker-build.yml). Elle tourne en émulation
# négligeable sur un hôte arm64 (service de fichiers statiques).
FROM source AS admin-builder
ARG VITE_API_URL=http://localhost:7532
ENV VITE_API_URL=$VITE_API_URL
RUN bun run --cwd apps/echoppe-admin build

FROM caddy:2-alpine AS admin
COPY --from=admin-builder /app/apps/echoppe-admin/dist /srv
COPY apps/echoppe-admin/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
