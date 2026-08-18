#!/usr/bin/env bun
// Garde anti-dérive schéma ↔ migrations, pour TOUS les produits du workspace.
//
//   bun run scripts/drift-guard.ts
//
// Le schéma Drizzle doit être entièrement capturé par les migrations committées. Si
// `drizzle-kit generate` produit le moindre fichier, c'est qu'une migration manque — typiquement
// des colonnes poussées en dev via `db:push` et jamais générées (l'incident 0.4.0).
//
// DÉCOUVERTE PAR CAPACITÉ, pas par nom. Le guard ne cherche ni « les cores », ni « les produits » :
// il cherche les `drizzle.config.ts`. Un produit qui possède un schéma est gardé ; un produit qui
// n'en a pas ne l'est pas, et c'est correct. Rien à éditer ici quand un second core apparaît —
// pas plus que le jour où l'un d'eux disparaît.
//
// Le dossier de migrations n'est pas deviné : il est lu dans la config elle-même (`out`), seule
// source de vérité — drizzle-kit lit la même.

import { Glob } from 'bun';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');

/** DATABASE_URL est requise à l'import de la config, mais aucune connexion n'est ouverte :
 *  `generate` compare le schéma TS aux snapshots sur disque, hors ligne. */
const OFFLINE_DATABASE_URL = 'postgres://placeholder:placeholder@127.0.0.1:5432/placeholder';

type Target = {
  /** Workspace possédant le schéma, relatif à la racine — ex. `packages/echoppe-core`. */
  readonly workspace: string;
  /** Dossier des migrations, résolu depuis `out` de la config. */
  readonly migrations: string;
};

async function discover(): Promise<readonly Target[]> {
  const glob = new Glob('**/drizzle.config.ts');
  const targets: Target[] = [];

  for (const hit of glob.scanSync({ cwd: ROOT, onlyFiles: true })) {
    if (hit.includes('node_modules')) continue;
    const workspace = dirname(hit);

    process.env.DATABASE_URL ??= OFFLINE_DATABASE_URL;

    // L'import peut échouer pour des raisons banales — `drizzle-kit` absent du workspace, config
    // qui lève au chargement. Sans ce catch, un workspace mal outillé fait tomber le guard ENTIER
    // avec une stack, au lieu de nommer le fautif.
    let module: unknown;
    try {
      module = await import(join(ROOT, hit));
    } catch (error) {
      fail(
        `${hit} : config illisible — ${error instanceof Error ? error.message : String(error)}\n` +
          `  Le workspace déclare un schéma mais ne peut pas charger sa config ` +
          `(dépendance \`drizzle-kit\` manquante ?).`,
      );
    }

    const out = readOut(module);
    if (out === null) {
      fail(`${hit} : impossible de lire \`out\` — la config ne dit pas où vivent ses migrations.`);
    }

    targets.push({ workspace, migrations: relative(ROOT, resolve(ROOT, workspace, out)) });
  }

  return targets.sort((a, b) => a.workspace.localeCompare(b.workspace));
}

function readOut(module: unknown): string | null {
  // `in` rétrécit lui-même depuis TS 4.9 : la propriété devient lisible sans rien asserter.
  if (typeof module !== 'object' || module === null || !('default' in module)) return null;
  const config: unknown = module.default;
  if (typeof config !== 'object' || config === null || !('out' in config)) return null;
  const out: unknown = config.out;
  return typeof out === 'string' ? out : null;
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function run(cmd: readonly string[], cwd: string): Promise<number> {
  const proc = Bun.spawn(cmd, {
    cwd,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? OFFLINE_DATABASE_URL },
    stdout: 'ignore',
    stderr: 'ignore',
  });
  return await proc.exited;
}

/** Fichiers modifiés OU non suivis sous `path` — un `.sql` neuf n'est pas « modifié ». */
async function dirtyFiles(path: string): Promise<readonly string[]> {
  const proc = Bun.spawn(['git', 'status', '--porcelain', '--', path], { cwd: ROOT, stdout: 'pipe' });
  const output = await new Response(proc.stdout).text();
  await proc.exited;
  return output.split('\n').filter((line) => line.trim() !== '');
}

const targets = await discover();

if (targets.length === 0) {
  console.log('⚠ Aucun `drizzle.config.ts` — aucun schéma à garder.');
  process.exit(0);
}

let drifted = false;

for (const target of targets) {
  const before = await dirtyFiles(target.migrations);
  if (before.length > 0) {
    // Sans ça, une migration légitimement en cours d'écriture serait imputée au guard.
    console.log(`⚠ ${target.migrations} : modifications non committées AVANT génération —`);
    for (const line of before) console.log(`    ${line}`);
  }

  const code = await run(['bun', 'run', 'db:generate', '--name=drift_guard'], join(ROOT, target.workspace));
  if (code !== 0) {
    fail(`${target.workspace} : \`db:generate\` a échoué (code ${code}).`);
  }

  const after = await dirtyFiles(target.migrations);
  const produced = after.filter((line) => !before.includes(line));

  if (produced.length > 0) {
    drifted = true;
    console.error(`✗ ${target.workspace} — dérive schéma ↔ migrations :`);
    for (const line of produced) console.error(`    ${line}`);
  } else {
    console.log(`✓ ${target.workspace} — schéma == migrations (${target.migrations})`);
  }
}

if (drifted) {
  console.error("\nLancer `bun run db:generate` dans le workspace concerné, puis committer le .sql");
  console.error('et les meta/*_snapshot.json produits.');
  process.exit(1);
}

console.log(`\n${targets.length} schéma(s) gardé(s), aucune dérive.`);
