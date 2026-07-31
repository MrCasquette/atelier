#!/usr/bin/env bun
// Prépare et pousse une release en une commande (flux « one-move », ADR-0023). Crée un changeset
// pour l'UNITÉ choisie au NIVEAU choisi, le committe et pousse `main` → la CI ouvre la PR « Version
// Packages » ; son merge publie l'unité (npm pour un paquet, images + tag `v*` pour le runtime).
//
// Unités indépendantes :
//   runtime → @echoppe/api (+ admin, paire fixed)  → images Docker + tag/Release git `v*`
//   sdk     → @echoppe/client                       → npm (pas de tag git)
//   content → @mrcasquette/content                      → npm
//   cli     → create-echoppe                        → npm
//
//   bun run ship runtime minor "ajoute X"     # explicite
//   bun run ship sdk patch "corrige le type"  # explicite
//   bun run ship "ajoute X"                    # interactif (demande unité + niveau)
//   bun run ship --dry runtime major "…"       # crée le changeset sans commit/push
//
// En 0.x, un changement CASSANT = `minor` (le `major` est réservé au passage 1.0).
import { $ } from 'bun';

const UNITS = {
  runtime: '@echoppe/api',
  sdk: '@echoppe/client',
  content: '@mrcasquette/content',
  cli: 'create-echoppe',
} as const;
type Unit = keyof typeof UNITS;
const LEVELS = ['patch', 'minor', 'major'] as const;
type Level = (typeof LEVELS)[number];

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function isUnit(value: string): value is Unit {
  return value in UNITS;
}
function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value);
}

const dry = process.argv.includes('--dry');
const args = process.argv.slice(2).filter((a) => a !== '--dry');

// Forme explicite `ship <unit> <level> <résumé…>` si les deux premiers args sont valides ;
// sinon tout est le résumé et on demande unité + niveau interactivement.
let unit: Unit | undefined;
let level: Level | undefined;
let summary: string;

if (args[0] && isUnit(args[0]) && args[1] && isLevel(args[1])) {
  unit = args[0];
  level = args[1];
  summary = args.slice(2).join(' ').trim();
} else {
  summary = args.join(' ').trim();
}

if (!unit) {
  const answer = (prompt(`Unité à bumper ? (${Object.keys(UNITS).join(' / ')})`) ?? '').trim();
  if (!isUnit(answer)) fail(`Unité invalide : « ${answer} » (attendu : ${Object.keys(UNITS).join(' | ')}).`);
  unit = answer;
}
if (!level) {
  const answer = (prompt(`Niveau ? (${LEVELS.join(' / ')}) [minor]`) ?? '').trim() || 'minor';
  if (!isLevel(answer)) fail(`Niveau invalide : « ${answer} » (attendu : ${LEVELS.join(' | ')}).`);
  level = answer;
}
if (!summary) {
  summary = (prompt('Résumé (ligne de changelog) ?') ?? '').trim();
  if (!summary) fail('Résumé requis.');
}

// Garde-fous : release depuis `main`, working tree propre (le changeset doit être le seul ajout
// embarqué, le reste du travail déjà committé).
const branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
if (branch !== 'main') fail(`Release depuis « ${branch} » refusée — bascule sur main.`);

const dirty = (await $`git status --porcelain`.text()).trim();
if (dirty && !dry) fail(`Working tree non propre — committe ou stash avant de ship :\n${dirty}`);

const pkg = UNITS[unit];
const slug = `ship-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
const file = `.changeset/${slug}.md`;
await Bun.write(file, `---\n"${pkg}": ${level}\n---\n\n${summary}\n`);
console.log(`✓ changeset ${unit} (${pkg}) ${level} : ${file}`);

if (dry) {
  console.log('(--dry) rien de committé/poussé. Retire --dry pour lancer la release.');
  process.exit(0);
}

await $`git add ${file}`;
await $`git commit -m ${`release(${unit}): ${level} — ${summary}`}`;
await $`git push origin main`;
console.log(
  `✓ poussé sur main (${unit} ${level}). La CI ouvre la PR « Version Packages » — merge-la pour publier.`,
);
