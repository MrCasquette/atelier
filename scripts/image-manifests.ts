#!/usr/bin/env bun
// Garde de complétude du `Dockerfile` : ses DEUX énumérations sont-elles à jour ?
//
//   bun run image-manifests
//
// Le Dockerfile énumère ses workspaces à deux endroits, pour deux raisons différentes, et une
// garde qui n'en regarde qu'un rend un verdict vert sur un fichier incomplet — c'est arrivé avec
// `@repo/pages-registry`, dont le stage `deps` a été corrigé pendant que `source` restait muet.
//
// `bun install --frozen-lockfile` refuse un lockfile dont un workspace manque — y compris ceux
// dont RIEN n'entre dans l'image. Le `Dockerfile` doit donc copier le `package.json` de CHAQUE
// workspace, sans exception.
//
// Il l'a longtemps fait par une ligne PAR workspace, faute de mieux : `COPY packages/*/package.json
// ./packages/` aplatit la destination, les manifestes s'écrasent l'un l'autre et il n'en reste
// qu'un. Ce n'est plus vrai — `COPY --parents` préserve l'arborescence (vérifié le 2026-08-25 :
// Docker 29.4.0, buildx 0.33, `# syntax=docker/dockerfile:1`), et le stage `deps` copie désormais
// les MOTIFS que `package.json` déclare en `workspaces`.
//
// Ce que cette garde vérifie a donc changé de niveau : plus « ce workspace est-il listé ? », mais
// « ce motif de workspace est-il couvert ? ». Un paquet neuf sous un motif existant n'a plus rien
// à faire ; un motif neuf — `tools/*` — reste à ajouter, et c'est ce qu'elle dit.
//
// Ce qu'elle empêchait, et empêche toujours d'un cran plus haut : `@repo/fields` a été créé pendant
// le chantier des entités sans rejoindre le `Dockerfile`. L'image n'étant construite qu'à la
// publication (`docker-build.yml`, jamais `ci.yml`), la release a échoué des semaines plus tard,
// sur un dépôt vert.
//
// Elle DÉCOUVRE, elle ne connaît pas : les motifs viennent du manifeste racine, les cibles de build
// des `--cwd` du Dockerfile.

import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Les motifs de workspace déclarés par le manifeste racine — `packages/*`, `apps/*`, `docs`. */
function workspacePatterns(): readonly string[] {
  const rootManifest: unknown = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  return isRecord(rootManifest) && Array.isArray(rootManifest.workspaces)
    ? rootManifest.workspaces.filter((p): p is string => typeof p === 'string')
    : [];
}

/** Les répertoires de workspace, découverts par ces motifs. */
function workspaceDirs(): readonly string[] {
  const dirs = new Set<string>();
  for (const pattern of workspacePatterns()) {
    for (const hit of new Glob(`${pattern}/package.json`).scanSync({ cwd: ROOT, onlyFiles: true })) {
      dirs.add(dirname(hit));
    }
  }
  return [...dirs].sort();
}

const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');

// Toutes les SOURCES des `COPY` du contexte de build — la destination n'a d'intérêt que pour
// Docker, et `--from=<stage>` copie depuis une étape, pas depuis le dépôt.
const contextSources = new Set<string>();
for (const line of dockerfile.split('\n')) {
  const copy = line.match(/^\s*COPY\s+((?:--\S+\s+)*)(.+)$/);
  if (copy === null || copy[1]?.includes('--from=') === true) continue;
  for (const source of (copy[2] ?? '').trim().split(/\s+/).slice(0, -1)) contextSources.add(source);
}

/** Le motif de copie qui couvre un motif de workspace, en y ajoutant le manifeste. */
function manifestGlob(pattern: string): string {
  return `${pattern}/package.json`;
}

// Le lockfile et le manifeste racine ne relèvent d'aucun motif, mais `bun install` les exige.
const REQUIRED_AT_ROOT = ['package.json', 'bun.lock'];

const uncovered = [
  ...REQUIRED_AT_ROOT.filter((file) => !contextSources.has(file)),
  ...workspacePatterns().map(manifestGlob).filter((glob) => !contextSources.has(glob)),
];

if (uncovered.length > 0) {
  console.error(`✗ ${uncovered.length} entrée(s) absente(s) du stage \`deps\` :\n`);
  for (const source of uncovered) console.error(`    ${source}`);
  console.error(
    `\n  À ajouter au \`COPY --parents\` qui précède \`bun install --frozen-lockfile\` — qui\n` +
      `  échouera sinon, au moment de publier et pas avant. Même les workspaces dont rien\n` +
      `  n'entre dans l'image : le lockfile les exige tous.`,
  );
  process.exit(1);
}

// ── Stage `source` : les node_modules de ce qui entre RÉELLEMENT dans le build ────────────────
//
// Celui-ci ne copie pas tous les workspaces, et c'est voulu : seulement ceux dont le code est
// compilé. Exiger la liste entière serait faux. Ce qu'on vérifie est donc une INCLUSION — tout ce
// qui est atteignable depuis les cibles de build doit être là ; le reste est libre.
//
// Les cibles ne sont pas connues d'avance : elles se lisent dans le Dockerfile lui-même, aux
// `--cwd` de ses `RUN`. Ajouter une application à construire suffit à étendre la garde.

/** Nom npm → répertoire, pour tous les workspaces découverts. */
function manifestOf(dir: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8'));
  return isRecord(parsed) ? parsed : {};
}

const dirByName = new Map<string, string>();
for (const dir of workspaceDirs()) {
  const name = manifestOf(dir).name;
  if (typeof name === 'string') dirByName.set(name, dir);
}

/** Les dépendances internes d'un workspace — celles déclarées `workspace:*`. */
function workspaceDeps(dir: string): string[] {
  const manifest = manifestOf(dir);
  const deps = isRecord(manifest.dependencies) ? manifest.dependencies : {};
  return Object.entries(deps)
    .filter(([, range]) => typeof range === 'string' && range.startsWith('workspace:'))
    .map(([name]) => name);
}

/** Les cibles de build, lues aux `--cwd` du Dockerfile. */
const buildTargets = new Set<string>();
for (const match of dockerfile.matchAll(/--cwd\s+(\S+)/g)) {
  const dir = match[1];
  if (dir) buildTargets.add(dir);
}

/** Fermeture transitive : tout ce qu'une cible de build finit par tirer. */
const required = new Set<string>();
const queue = [...buildTargets];
while (queue.length > 0) {
  const dir = queue.pop();
  if (dir === undefined || required.has(dir)) continue;
  required.add(dir);
  for (const name of workspaceDeps(dir)) {
    const next = dirByName.get(name);
    if (next !== undefined && !required.has(next)) queue.push(next);
  }
}

// `COPY --from=deps /app/<dir>/node_modules …`
const linked = new Set<string>();
for (const match of dockerfile.matchAll(
  /^\s*COPY\s+--from=deps\s+\/app\/(\S+)\/node_modules\s/gm,
)) {
  const dir = match[1];
  if (dir) linked.add(dir);
}

const unlinked = [...required].filter((dir) => !linked.has(dir)).sort();

if (unlinked.length > 0) {
  console.error(`✗ ${unlinked.length} workspace(s) absent(s) du stage \`source\` :\n`);
  for (const dir of unlinked) {
    console.error(`    COPY --from=deps /app/${dir}/node_modules ./${dir}/node_modules`);
  }
  console.error(
    `\n  Ils sont atteignables depuis une cible de build (${[...buildTargets].join(', ')}),\n` +
      `  donc leur code est compilé et leurs dépendances doivent suivre.`,
  );
  process.exit(1);
}

console.log(
  `✓ Dockerfile — ${workspacePatterns().length} motifs de workspace couverts au stage \`deps\` ` +
    `(${workspaceDirs().length} paquets), ${required.size} liés au stage \`source\`.`,
);
