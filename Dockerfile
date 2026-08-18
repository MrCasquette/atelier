# Échoppe - Monorepo Dockerfile (Optimized)
# Build target: api — UNE image runtime, qui sert aussi le dashboard sous /-/admin (ADR-0052).
#
# Usage:
#   docker build --target api -t echoppe/api .
#
# Le dashboard n'a plus d'image ni d'URL d'API à connaître : il est servi par l'API et déduit sa
# base de sa propre origine. Rien à passer au build.
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
COPY packages/echoppe-core/package.json ./packages/echoppe-core/
COPY packages/shared/package.json ./packages/shared/
COPY packages/assets/package.json ./packages/assets/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY packages/adapters/package.json ./packages/adapters/
COPY packages/identity/package.json ./packages/identity/
COPY packages/entities/package.json ./packages/entities/
COPY packages/fields/package.json ./packages/fields/
COPY packages/pages/package.json ./packages/pages/
COPY packages/menus/package.json ./packages/menus/
COPY packages/references/package.json ./packages/references/
COPY packages/communication/package.json ./packages/communication/
COPY packages/echoppe-client/package.json ./packages/echoppe-client/
COPY packages/content/package.json ./packages/content/
COPY packages/create-echoppe/package.json ./packages/create-echoppe/
# Workspaces d'un AUTRE produit, copiés uniquement parce que `--frozen-lockfile` refuse un
# lockfile dont un workspace manque. Rien de Prisme n'entre dans l'image ; l'énumération manuelle
# de ce Dockerfile est ce qui l'y oblige (cf. backlog socle).
COPY packages/create-prisme/package.json ./packages/create-prisme/
COPY apps/prisme-api/package.json ./apps/prisme-api/
COPY apps/prisme-admin/package.json ./apps/prisme-admin/
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
COPY --from=deps /app/packages/echoppe-core/node_modules ./packages/echoppe-core/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/assets/node_modules ./packages/assets/node_modules
COPY --from=deps /app/packages/auth/node_modules ./packages/auth/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/adapters/node_modules ./packages/adapters/node_modules
COPY --from=deps /app/packages/identity/node_modules ./packages/identity/node_modules
COPY --from=deps /app/packages/entities/node_modules ./packages/entities/node_modules
COPY --from=deps /app/packages/fields/node_modules ./packages/fields/node_modules
COPY --from=deps /app/packages/pages/node_modules ./packages/pages/node_modules
COPY --from=deps /app/packages/menus/node_modules ./packages/menus/node_modules
COPY --from=deps /app/packages/references/node_modules ./packages/references/node_modules
COPY --from=deps /app/packages/communication/node_modules ./packages/communication/node_modules
COPY --from=deps /app/apps/echoppe-api/node_modules ./apps/echoppe-api/node_modules
COPY --from=deps /app/apps/echoppe-admin/node_modules ./apps/echoppe-admin/node_modules
COPY --from=deps /app/apps/echoppe-store/node_modules ./apps/echoppe-store/node_modules
COPY --from=deps /app/docs/node_modules ./docs/node_modules
COPY . .

# ==============================================================================
# Dashboard (site statique, servi par l'API)
# ==============================================================================
# `--platform=$BUILDPLATFORM` : le `dist` de Vite est arch-indépendant, et le construire sous
# émulation QEMU arm64 coûtait ~4 min (~70× le natif) — c'est ce qui obligeait à publier le
# dashboard en amd64 seul. Épinglé sur la plateforme de BUILD, il se construit une fois
# nativement, et le même `dist` part dans les deux architectures.
FROM --platform=$BUILDPLATFORM source AS dashboard-builder
RUN bun run --cwd apps/echoppe-admin build

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
# Dashboard servi sous /-/admin. Absent du dossier = plugin inerte (cf. src/dashboard.ts).
ENV DASHBOARD_DIR=/app/dashboard

RUN addgroup -g 1001 -S echoppe && \
    adduser -S echoppe -u 1001

COPY --from=api-builder --chown=echoppe:echoppe /app/apps/echoppe-api/api ./api
COPY --from=dashboard-builder --chown=echoppe:echoppe /app/apps/echoppe-admin/dist ./dashboard
COPY --chown=echoppe:echoppe packages/echoppe-core/drizzle ./drizzle

RUN mkdir -p /app/uploads && chown -R echoppe:echoppe /app/uploads

USER echoppe
EXPOSE 7532

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:7532/-/health || exit 1

CMD ["./api"]

