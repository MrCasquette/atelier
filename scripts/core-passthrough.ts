#!/usr/bin/env bun
// Garde : un cœur produit ne sert pas de raccourci vers les paquets partagés.
//
// Le problème qu'elle empêche de revenir. `@echoppe/core` réexportait 54 symboles empruntés à sept
// paquets `@repo/*` — `db`, `eq`, `media`, `user`… Le confort est réel, le coût aussi : l'API
// consommait `@repo/db` et `@repo/assets` sans les déclarer, et le découpage en paquets devenait
// un décor, puisque tout entrait par la même porte. Un commentaire en tête du barrel demandait
// déjà de ne pas s'en servir ainsi ; il n'a rien empêché, parce qu'un commentaire n'échoue pas.
//
// Ce qu'elle NE condamne pas : le manifeste de migration. Drizzle ne migre que ce qu'il voit
// depuis un point d'entrée unique, donc un cœur DOIT énumérer quelque part les tables partagées
// qu'il embarque (ADR-0025). Cette énumération est légitime tant qu'elle reste hors des `exports`
// du paquet — inatteignable par un import. C'est exactement ce que la garde vérifie : elle ne lit
// pas les fichiers du disque, elle part des points d'entrée DÉCLARÉS et suit les réexports.
//
// Découverte, jamais énumération (cf. conventions § L'outillage découvre) :
//   - les cœurs produit          → les workspaces qui possèdent un `drizzle.config.ts`
//   - les paquets partagés       → les autres workspaces du dépôt, par leur nom déclaré
//   - les fichiers à inspecter   → les `exports` du manifeste, puis les réexports relatifs

import { existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { allWorkspaces, isRecord, readJson, readText, ROOT, type Workspace } from './lib/release-units';

/** Un réexport `export … from '<source>'`, et la ligne où le lire. */
const REEXPORT = /^\s*export\s[\s\S]*?from\s+'([^']+)';/gm;

interface Leak {
  readonly file: string;
  readonly source: string;
  readonly via: readonly string[];
}

/** Les cœurs produit : ceux qui possèdent des migrations. */
function productCores(workspaces: ReadonlyMap<string, Workspace>): readonly Workspace[] {
  return [...workspaces.values()].filter((w) => existsSync(join(ROOT, w.dir, 'drizzle.config.ts')));
}

/** Les points d'entrée déclarés — la seule surface qu'un consommateur peut atteindre. */
function entryPoints(core: Workspace): readonly string[] {
  const manifest = readJson(join(core.dir, 'package.json'));
  if (!isRecord(manifest)) return [];
  const exports = manifest.exports;
  if (typeof exports === 'string') return [exports];
  if (!isRecord(exports)) return [];

  const entries: string[] = [];
  const collect = (value: unknown): void => {
    if (typeof value === 'string') entries.push(value);
    else if (isRecord(value)) Object.values(value).forEach(collect);
  };
  collect(exports);
  return entries;
}

/** Le fichier qu'un chemin relatif désigne — `./x` peut valoir `x.ts` comme `x/index.ts`. */
function resolveLocal(fromFile: string, source: string): string | null {
  const base = resolve(dirname(fromFile), source);
  for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function inspect(core: Workspace, packageNames: ReadonlySet<string>): readonly Leak[] {
  const leaks: Leak[] = [];
  const seen = new Set<string>();

  // File d'attente : le fichier à lire, et le chemin de réexports qui y a mené.
  interface Pending {
    readonly file: string;
    readonly via: readonly string[];
  }
  const queue: Pending[] = entryPoints(core)
    .map((entry) => ({ file: resolve(ROOT, core.dir, entry), via: [] }))
    .filter((item) => existsSync(item.file));

  for (let item = queue.shift(); item; item = queue.shift()) {
    const { file, via } = item;
    if (seen.has(file)) continue;
    seen.add(file);

    const shown = relative(ROOT, file);
    for (const match of readText(shown).matchAll(REEXPORT)) {
      const source = match[1];
      if (!source) continue;
      if (source.startsWith('.')) {
        const next = resolveLocal(file, source);
        if (next) queue.push({ file: next, via: [...via, shown] });
        continue;
      }
      // Un paquet du dépôt qui n'est pas le cœur lui-même : le cœur sert de raccourci vers lui.
      const owner = [...packageNames].find((name) => source === name || source.startsWith(`${name}/`));
      if (owner && owner !== core.name) leaks.push({ file: shown, source, via });
    }
  }
  return leaks;
}

const workspaces = allWorkspaces();
const cores = productCores(workspaces);
const packageNames = new Set(workspaces.keys());

if (cores.length === 0) {
  console.error('Aucun cœur produit trouvé — la sonde `drizzle.config.ts` ne répond plus.');
  process.exit(1);
}

let failed = false;
for (const core of cores) {
  const leaks = inspect(core, packageNames);
  if (leaks.length === 0) {
    console.log(`✓ ${core.name} — n'expose que ce qui lui appartient`);
    continue;
  }
  failed = true;
  console.error(`\n✗ ${core.name} réexporte ${leaks.length} fois un paquet partagé :\n`);
  for (const leak of leaks) {
    const path = leak.via.length > 0 ? `${leak.via.join(' → ')} → ${leak.file}` : leak.file;
    console.error(`  ${path}`);
    console.error(`    export … from '${leak.source}'`);
  }
}

if (failed) {
  console.error(`
Un cœur produit possède sa base et ses migrations ; il ne prête pas sa surface aux paquets
partagés. Le consommateur importe depuis le paquet d'origine et le déclare dans son manifeste.

Si ce réexport sert le manifeste de migration, il doit vivre dans un fichier absent des
\`exports\` du paquet — inatteignable par un import, donc invisible pour cette garde.`);
  process.exit(1);
}
