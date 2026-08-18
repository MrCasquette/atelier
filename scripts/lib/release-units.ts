// Les unités de release du dépôt, découvertes plutôt que connues.
//
// Une unité, c'est :
//   - tout workspace publiable (manifeste sans `private: true`) ;
//   - tout groupe `fixed` de la configuration changesets — c'est ainsi que le runtime, privé mais
//     porteur du tag `v*` et des images Docker (ADR-0023), se déclare comme versionné d'un tenant.
//
// Un workspace privé qui n'est ni l'un ni l'autre (`@repo/*`, `@echoppe/core`) ne se publie pas
// seul : il est PORTÉ par les unités qui en dépendent. Ses dossiers leur sont donc rattachés, en
// suivant le graphe de dépendances internes.
//
// Extrait de `release-coverage.ts` au moment où `registry-gap.ts` en a eu besoin — deuxième usage
// réel, pas anticipation.

import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dir, '../..');

export interface Workspace {
  readonly name: string;
  readonly dir: string;
  readonly private: boolean;
  readonly version: string;
  readonly deps: readonly string[];
}

export interface Unit {
  /** Les paquets versionnés ensemble. Un changeset sur l'un vaut pour tous. */
  readonly members: readonly Workspace[];
  /** Ce dont l'unité est faite : ses membres, plus les workspaces privés qu'elle porte. */
  readonly dirs: readonly string[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
}

export function readText(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

export function git(...args: readonly string[]): string {
  const result = Bun.spawnSync(['git', ...args], { cwd: ROOT });
  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new Error(`git ${args.join(' ')} — ${stderr}`);
  }
  return new TextDecoder().decode(result.stdout);
}

/** Tous les workspaces, découverts par les motifs du manifeste racine. */
export function allWorkspaces(): ReadonlyMap<string, Workspace> {
  const rootManifest = readJson('package.json');
  const patterns =
    isRecord(rootManifest) && Array.isArray(rootManifest.workspaces)
      ? rootManifest.workspaces.filter((pattern): pattern is string => typeof pattern === 'string')
      : [];

  const found = new Map<string, Workspace>();
  for (const pattern of patterns) {
    for (const hit of new Glob(`${pattern}/package.json`).scanSync({ cwd: ROOT, onlyFiles: true })) {
      const manifest = readJson(hit);
      if (!isRecord(manifest) || typeof manifest.name !== 'string') continue;

      const deps = new Set<string>();
      for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
        const block = manifest[field];
        if (isRecord(block)) for (const dep of Object.keys(block)) deps.add(dep);
      }

      found.set(manifest.name, {
        name: manifest.name,
        dir: dirname(hit),
        private: manifest.private === true,
        version: typeof manifest.version === 'string' ? manifest.version : '',
        deps: [...deps],
      });
    }
  }
  return found;
}

/** Les groupes de paquets que changesets versionne d'un seul tenant. */
export function fixedGroups(): readonly (readonly string[])[] {
  const config = readJson('.changeset/config.json');
  if (!isRecord(config) || !Array.isArray(config.fixed)) return [];
  return config.fixed
    .filter((group): group is unknown[] => Array.isArray(group))
    .map((group) => group.filter((name): name is string => typeof name === 'string'));
}

export function buildUnits(workspaces: ReadonlyMap<string, Workspace>): readonly Unit[] {
  const groups: string[][] = [];
  const grouped = new Set<string>();

  for (const group of fixedGroups()) {
    const members = group.filter((name) => workspaces.has(name));
    if (members.length === 0) continue;
    groups.push(members);
    for (const name of members) grouped.add(name);
  }

  for (const workspace of workspaces.values()) {
    if (workspace.private || grouped.has(workspace.name)) continue;
    groups.push([workspace.name]);
    grouped.add(workspace.name);
  }

  return groups.map((names) => {
    const members = names
      .map((name) => workspaces.get(name))
      .filter((workspace): workspace is Workspace => workspace !== undefined);
    const dirs = new Set<string>(members.map((member) => member.dir));

    // Descente dans les dépendances internes : un workspace privé traversé appartient à l'unité,
    // un workspace qui se publie lui-même arrête la descente — il répond de ses propres changements.
    const queue = [...names];
    const seen = new Set<string>(names);
    while (queue.length > 0) {
      const current = queue.shift();
      const workspace = current === undefined ? undefined : workspaces.get(current);
      if (!workspace) continue;

      for (const dep of workspace.deps) {
        const target = workspaces.get(dep);
        if (!target || seen.has(dep)) continue;
        seen.add(dep);
        if (grouped.has(dep) && !names.includes(dep)) continue;
        dirs.add(target.dir);
        queue.push(dep);
      }
    }

    return { members, dirs: [...dirs].sort() };
  });
}

/**
 * L'unité du runtime : celle dont aucun membre ne se publie sur npm. C'est elle qui porte le tag
 * `v*` et les images. On la reconnaît à cette propriété plutôt qu'à son nom — un second produit
 * doté de sa propre paire `fixed` serait reconnu de la même façon.
 */
export function runtimeUnits(units: readonly Unit[]): readonly Unit[] {
  return units.filter(
    (unit) => unit.members.length > 0 && unit.members.every((member) => member.private),
  );
}
