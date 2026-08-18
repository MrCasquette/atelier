#!/usr/bin/env bun
// L'écart entre ce que le dépôt a committé et ce que les registres servent réellement.
//
//   bun run registry-gap
//
// L'invariant : toute version committée d'une unité de release doit EXISTER dans son registre. Si
// `apps/echoppe-api/package.json` dit `0.7.0` et que GHCR n'a pas de `0.7.0`, la release ne s'est
// pas terminée.
//
// Ce qu'elle empêche : le 18 août 2026, la release a publié trois paquets npm et n'a jamais
// construit l'image — l'étape qui résout la version runtime lisait un arbre de travail que
// `changeset version` venait de muter pour PRÉPARER la PR, si bien que le tag `v0.7.0` est né avant
// tout merge. Tous les runs suivants ont conclu « déjà taggé → aucune nouvelle image ». Le dépôt
// était vert, npm était à jour, et l'image avait dix-huit jours.
//
// Elle complète `release-coverage`, qui mesure « la source a bougé sans changeset ». Celle-ci
// mesure « le changeset est parti mais l'artefact n'est pas arrivé ». Ensemble, elles ferment la
// boucle entre le dépôt et le monde.
//
// Elle interroge le réseau, ce qui la distingue des autres gardes, toutes hors-ligne et
// déterministes. Sa place n'est donc PAS sur une PR : entre le merge de la PR de version et la
// publication effective, l'écart est légitime, et une PR rouge punirait quelqu'un qui n'y peut
// rien. Son branchement en fin de workflow `Release` reste à faire (backlog `shared.md`).

import {
  allWorkspaces,
  buildUnits,
  isRecord,
  readText,
  runtimeUnits,
  type Unit,
} from './lib/release-units';

/** npm expose une version fraîche avec quelques secondes de retard. */
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 4000;

interface Check {
  readonly label: string;
  readonly registry: string;
  readonly version: string;
  readonly published: boolean;
  readonly latest: string;
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/** Les images publiées, découvertes dans le workflow qui les construit. */
function discoverImages(): readonly string[] {
  const workflow = readText('.github/workflows/docker-build.yml');

  const prefix = workflow.match(/IMAGE_PREFIX:\s*(\S+)/)?.[1];
  if (!prefix) fail("`IMAGE_PREFIX` introuvable dans `docker-build.yml` — l'image ne se déduit plus.");

  const targets = [...workflow.matchAll(/^\s*-\s*target:\s*(\S+)/gm)].map((match) => match[1]);
  if (targets.length === 0) fail('Aucune cible d’image dans la matrice de `docker-build.yml`.');

  return targets.map((target) => `${prefix}-${target}`);
}

async function npmVersions(name: string): Promise<readonly string[]> {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (response.status === 404) return [];
  if (!response.ok) fail(`npm a répondu ${response.status} pour ${name}.`);

  const body: unknown = await response.json();
  if (!isRecord(body) || !isRecord(body.versions)) return [];
  return Object.keys(body.versions);
}

/** Les tags d'un paquet de conteneur GHCR, via l'API GitHub — pas de `docker login` requis. */
async function ghcrTags(image: string): Promise<readonly string[]> {
  const [, owner, name] = image.split('/');
  if (!owner || !name) fail(`Image non interprétable : ${image}`);

  const result = Bun.spawnSync([
    'gh',
    'api',
    '--paginate',
    `/users/${owner}/packages/container/${name}/versions`,
    '--jq',
    '.[].metadata.container.tags[]',
  ]);

  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    fail(
      `GHCR illisible pour ${image} — ${stderr.split('\n')[0]}\n\n` +
        '  En local : `gh auth login`. En CI : `packages: read` et `GH_TOKEN`.',
    );
  }
  return new TextDecoder().decode(result.stdout).trim().split('\n').filter(Boolean);
}

/** La version la plus récente au sens sémantique, pour situer l'écart quand il y en a un. */
function newest(versions: readonly string[]): string {
  const ordered = versions
    .filter((version) => /^\d+\.\d+\.\d+$/.test(version))
    .sort((a, b) => {
      const left = a.split('.').map(Number);
      const right = b.split('.').map(Number);
      for (let index = 0; index < 3; index++) {
        const delta = (left[index] ?? 0) - (right[index] ?? 0);
        if (delta !== 0) return delta;
      }
      return 0;
    });
  return ordered.at(-1) ?? '—';
}

async function collect(units: readonly Unit[]): Promise<readonly Check[]> {
  const checks: Check[] = [];

  for (const unit of units) {
    for (const member of unit.members) {
      if (member.private) continue;
      const versions = await npmVersions(member.name);
      checks.push({
        label: member.name,
        registry: 'npm',
        version: member.version,
        published: versions.includes(member.version),
        latest: newest(versions),
      });
    }
  }

  // Les images portent la version du runtime — l'unité dont aucun membre ne se publie sur npm.
  for (const unit of runtimeUnits(units)) {
    const version = unit.members[0]?.version ?? '';
    for (const image of discoverImages()) {
      const tags = await ghcrTags(image);
      checks.push({
        label: image,
        registry: 'ghcr',
        version,
        published: tags.includes(version),
        latest: newest(tags),
      });
    }
  }

  return checks;
}

const units = buildUnits(allWorkspaces());

let checks = await collect(units);
// Une version tout juste publiée peut n'être pas encore visible. On ne réessaie que s'il manque
// quelque chose : le cas vert ne paie jamais l'attente.
for (let attempt = 1; attempt < ATTEMPTS && checks.some((check) => !check.published); attempt++) {
  console.log(`  … absente à l'appel ${attempt}, nouvelle tentative dans ${RETRY_DELAY_MS / 1000} s`);
  await Bun.sleep(RETRY_DELAY_MS);
  checks = await collect(units);
}

const width = Math.max(...checks.map((check) => check.label.length));
for (const check of checks) {
  const mark = check.published ? '✓' : '✗';
  const served = check.published ? '' : `   (le registre sert ${check.latest})`;
  console.log(`  ${mark} ${check.label.padEnd(width)}  ${check.version}  [${check.registry}]${served}`);
}

const missing = checks.filter((check) => !check.published);
if (missing.length > 0) {
  console.error(`\n✗ ${missing.length} version(s) committée(s) absente(s) de leur registre.`);
  console.error(
    "\n  Une release ne s'est pas terminée. Vérifiez le dernier workflow `Release` : npm et les" +
      "\n  images sont publiés par des étapes distinctes, et l'une peut réussir sans l'autre.",
  );
  process.exit(1);
}

console.log(`\n✓ Les ${checks.length} artefacts committés sont servis par leur registre.`);
