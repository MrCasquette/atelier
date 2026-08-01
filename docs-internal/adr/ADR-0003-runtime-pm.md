# ADR-0003 — Runtime & package manager : PM-agnostique, Bun API / Node front

Statut : accepté · 2026-07-08
Portée : socle

## Contexte

Crainte initiale « bugs Bun en prod Linux » restée abstraite (non vécue sur cette API Elysia, qui est
le use-case le mieux supporté de Bun). Trois axes souvent confondus : package manager, build, runtime.

## Options envisagées

- **Full-Bun** (runtime + PM imposé) — simple mais couple le repo à Bun.
- **Migration runtime Bun → Node** immédiate — 20+ fichiers touchés pour fuir un risque non
  caractérisé.
- **Séparer les 3 axes** — PM libre, runtime choisi par couche.

## Décision

Trois axes **indépendants** :
- **Package manager = agnostique** (npm/bun/yarn/pnpm). `workspaces` + `pnpm-workspace.yaml`, pas de
  champ `packageManager` (Corepack retiré), lockfile canonique **`bun.lock`** (les autres gitignorés).
- **Build = Bun** (`bun build --compile --target bun` pour l'api) + node-based (vite/astro/tsc).
- **Runtime = Bun** pour l'API (binaire compilé), **Node** pour le front Astro.

Migration runtime Bun → Node **différée**. Palier à une ligne avant tout gros chantier : passer le
Dockerfile de `oven/bun:1-alpine` à `oven/bun:1` (Debian/glibc) neutralise la classe de bugs musl.

## Conséquences

- Zéro dep fantôme validé sous le `node_modules` strict de pnpm (`bun build --compile` + type-check
  complet passent) → la promesse « any PM » tient sans hoist-hack.
- Couplage runtime mesuré si migration un jour (~13 appels `Bun.*`) : `Bun.password` (exige `argon2`
  npm pour rester compatible avec les hash PHC argon2id existants), `Bun.file/write`, `Bun.spawn`.
  Elysia supporte Node via `@elysiajs/node` ; Eden Treaty inchangé.

## Détail

→ [contraintes-outillage.md](../reference/contraintes-outillage.md)
