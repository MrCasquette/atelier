#!/usr/bin/env bun
// Garde de complétude du `Dockerfile` : tout workspace du monorepo y est-il copié ?
//
//   bun run image-manifests
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
  console.error(`✗ ${missing.length} workspace(s) absent(s) du Dockerfile :\n`);
  for (const dir of missing) console.error(`    COPY ${dir}/package.json ./${dir}/`);
  console.error(
    `\n  À ajouter au stage \`deps\`, avant \`bun install --frozen-lockfile\` — qui échouera sinon,\n` +
      `  au moment de publier et pas avant. Même les workspaces dont rien n'entre dans l'image.`,
  );
  process.exit(1);
}

console.log(`✓ Dockerfile — les ${workspaceDirs().length} workspaces sont copiés.`);
