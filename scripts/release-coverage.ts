#!/usr/bin/env bun
// Garde de couverture des releases : une unité de release dont la source a bougé depuis sa dernière
// version doit être mentionnée par un changeset.
//
//   bun run release-coverage
//
// Ce qu'elle empêche, deux fois :
//   - `@axiome-apps/echoppe-client` avait perdu `company.get()` et gagné `identity.get()` — une rupture de
//     contrat pour tout consommateur — sans qu'aucun changeset ne le couvre ;
//   - le runtime `api`+`admin` accumulait 72 commits sans changeset. Il est PRIVÉ, mais c'est lui
//     qui porte le tag `v*` et les images Docker (ADR-0023) : la release suivante aurait publié les
//     paquets npm et n'aurait jamais reconstruit l'image.
//
// Pourquoi rien ne l'attrapait : `contracts:check` compare le SDK aux ROUTES, `drift-guard` le
// schéma aux MIGRATIONS. Les deux mesurent une cohérence interne au dépôt. Personne ne mesurait
// l'écart entre ce qui est committé et ce qui est PUBLIÉ.
//
// Elle DÉCOUVRE les unités, elle ne les connaît pas — cf. `lib/release-units.ts`.
//
// La référence est locale, jamais le registre : la dernière release d'une unité est le dernier
// commit qui a MODIFIÉ son `CHANGELOG.md`, que `changeset version` réécrit à chaque publication.
// L'historique est suivi à travers les renommages, sinon un paquet déplacé paraîtrait neuf ; et le
// déplacement lui-même est écarté, sinon il tiendrait lieu de release et masquerait tout ce qui
// l'a précédé — c'est ce qui cachait la dérive du SDK.

import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  allWorkspaces,
  buildUnits,
  git,
  ROOT,
  type Unit,
} from './lib/release-units';

/** Ne peuvent pas atteindre l'artefact publié : le journal que la release écrit, et les tests. */
const IRRELEVANT = [/(^|\/)CHANGELOG\.md$/, /\.test\.[cm]?[jt]sx?$/];

/** Un renommage sans la moindre modification. Le paquet a déménagé, il n'a pas changé. */
const PURE_RENAME = 'R100';

const SHOWN_PER_UNIT = 5;

/**
 * Tous les dossiers qu'un paquet a occupés, retrouvés par l'historique de son `CHANGELOG.md`. Sans
 * eux, un paquet renommé paraîtrait entièrement neuf et la comparaison perdrait son point de repère.
 */
function historicalDirs(dir: string): readonly string[] {
  const output = git('log', '--follow', '--format=', '--name-only', '--', join(dir, 'CHANGELOG.md'));
  const dirs = new Set<string>([dir]);
  for (const line of output.split('\n')) {
    const path = line.trim();
    if (path) dirs.add(dirname(path));
  }
  return [...dirs];
}

/** Le commit de la dernière release, ou `null` si l'unité n'a jamais été publiée. */
function lastReleaseCommit(unit: Unit): string | null {
  // `--diff-filter=AM` écarte les renommages : déplacer un paquet touche son journal sans rien
  // publier, et prendre ce commit pour repère masquerait tout ce qui l'a précédé.
  for (const member of unit.members) {
    const output = git(
      'log',
      '--follow',
      '--diff-filter=AM',
      '-1',
      '--format=%H',
      '--',
      join(member.dir, 'CHANGELOG.md'),
    ).trim();
    if (output) return output;
  }
  return null;
}

/** Les fichiers modifiés depuis la release, hors renommages purs et fichiers sans effet publié. */
function changedSince(commit: string, dirs: readonly string[]): readonly string[] {
  const watched = new Set<string>(dirs);
  for (const dir of dirs) for (const historical of historicalDirs(dir)) watched.add(historical);

  const output = git('diff', '--name-status', '-M', `${commit}..HEAD`, '--', ...watched);
  const changed = new Set<string>();

  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const [status, ...paths] = line.split('\t');
    const path = paths.at(-1);
    if (!status || !path) continue;
    if (status === PURE_RENAME) continue;
    if (IRRELEVANT.some((pattern) => pattern.test(path))) continue;
    changed.add(path);
  }
  return [...changed].sort();
}

/** Les paquets nommés par les changesets en attente. */
function coveredPackages(): ReadonlySet<string> {
  const covered = new Set<string>();
  // `dot` : sans lui, Bun ignore `.changeset/` et la garde ne verrait aucune couverture.
  for (const hit of new Glob('.changeset/*.md').scanSync({ cwd: ROOT, onlyFiles: true, dot: true })) {
    if (hit.endsWith('README.md')) continue;
    const frontmatter = readFileSync(join(ROOT, hit), 'utf8').split('---')[1];
    if (!frontmatter) continue;
    for (const line of frontmatter.split('\n')) {
      const match = line.match(/^\s*['"]?(@?[^'":\s]+)['"]?\s*:\s*(major|minor|patch)\s*$/);
      if (match?.[1]) covered.add(match[1]);
    }
  }
  return covered;
}

// Un clone superficiel ne porte pas l'historique du `CHANGELOG.md` : la garde ne trouverait aucun
// changement et passerait au vert sans rien avoir mesuré. Elle doit échouer bruyamment.
if (git('rev-parse', '--is-shallow-repository').trim() === 'true') {
  console.error('✗ Historique superficiel — cette garde a besoin du dépôt complet.');
  console.error('\n  En CI : `fetch-depth: 0` sur le checkout du job qui la lance.');
  process.exit(1);
}

const units = buildUnits(allWorkspaces());
const covered = coveredPackages();
const uncovered: { unit: Unit; changed: readonly string[]; released: boolean }[] = [];

for (const unit of units) {
  if (unit.members.some((member) => covered.has(member.name))) continue;

  const release = lastReleaseCommit(unit);
  if (!release) {
    uncovered.push({ unit, changed: [], released: false });
    continue;
  }

  const changed = changedSince(release, unit.dirs);
  if (changed.length > 0) uncovered.push({ unit, changed, released: true });
}

if (uncovered.length > 0) {
  console.error(`✗ ${uncovered.length} unité(s) de release sans changeset :\n`);
  for (const { unit, changed, released } of uncovered) {
    const label = unit.members.map((member) => member.name).join(' + ');
    if (!released) {
      console.error(`  ${label} — jamais publiée, et aucun changeset ne la mentionne.`);
      continue;
    }
    console.error(`  ${label} — ${changed.length} fichier(s) modifié(s) depuis sa version :`);
    for (const path of changed.slice(0, SHOWN_PER_UNIT)) console.error(`      ${path}`);
    if (changed.length > SHOWN_PER_UNIT) {
      console.error(`      … et ${changed.length - SHOWN_PER_UNIT} autre(s)`);
    }
  }
  console.error(
    `\n  Décrivez le changement — \`bun changeset\` —, ou expliquez ici pourquoi il ne se publie pas.` +
      `\n  Sans quoi la prochaine release emportera les unités couvertes et laissera celles-ci en` +
      `\n  arrière : un SDK figé contre une API qui a changé, ou une image jamais reconstruite.`,
  );
  process.exit(1);
}

console.log(`✓ Les ${units.length} unités de release sont à jour ou couvertes par un changeset.`);
