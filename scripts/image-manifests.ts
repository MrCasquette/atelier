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
// workspace, sans exception, et cette liste est écrite à la main.
//
// Elle l'est parce que Docker ne sait pas faire autrement : `COPY packages/*/package.json
// ./packages/` **aplatit** la destination — les manifestes s'écrasent l'un l'autre et il n'en
// reste qu'un, le nom du dossier perdu. Aucun motif ne préserve l'arborescence, d'où une ligne
// par workspace.
//
// Ce que cette garde empêche : `@repo/fields` a été créé pendant le chantier des entités sans
// rejoindre le `Dockerfile`. L'image n'étant construite qu'à la publication (`docker-build.yml`,
// jamais `ci.yml`), la release a échoué des semaines plus tard, sur un dépôt vert.
//
// Elle DÉCOUVRE les workspaces, elle ne les connaît pas : un nouveau paquet est couvert sans qu'on
// touche à ce fichier.

import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Les répertoires de workspace déclarés par le manifeste racine, découverts par ses motifs. */
function workspaceDirs(): readonly string[] {
  const rootManifest: unknown = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const patterns =
    isRecord(rootManifest) && Array.isArray(rootManifest.workspaces)
      ? rootManifest.workspaces.filter((p): p is string => typeof p === 'string')
      : [];

  const dirs = new Set<string>();
  for (const pattern of patterns) {
    for (const hit of new Glob(`${pattern}/package.json`).scanSync({ cwd: ROOT, onlyFiles: true })) {
      dirs.add(dirname(hit));
    }
  }
  return [...dirs].sort();
}

const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');

// `COPY <chemin>/package.json ./<chemin>/` — on ne lit que la SOURCE, la destination n'ayant
// d'intérêt que pour Docker.
const copied = new Set<string>();
for (const line of dockerfile.split('\n')) {
  const match = line.match(/^\s*COPY\s+(?:--\S+\s+)*(\S+)\/package\.json\s/);
  if (match?.[1]) copied.add(match[1]);
}

const missing = workspaceDirs().filter((dir) => !copied.has(dir));

if (missing.length > 0) {
  console.error(`✗ ${missing.length} workspace(s) absent(s) du stage \`deps\` :\n`);
  for (const dir of missing) console.error(`    COPY ${dir}/package.json ./${dir}/`);
  console.error(
    `\n  À ajouter avant \`bun install --frozen-lockfile\` — qui échouera sinon, au moment de\n` +
      `  publier et pas avant. Même les workspaces dont rien n'entre dans l'image.`,
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
  `✓ Dockerfile — ${workspaceDirs().length} workspaces copiés au stage \`deps\`, ` +
    `${required.size} liés au stage \`source\`.`,
);
