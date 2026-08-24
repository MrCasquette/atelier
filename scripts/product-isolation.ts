#!/usr/bin/env bun
// Garde d'isolation entre produits frères.
//
//   bun run product-isolation
//
// Échoppe et Prisme sont des PAIRS, pas des couches. Ils partagent des paquets `@repo/*` et des
// artefacts neutres, jamais leurs propres briques : le jour où Échoppe importerait `@prisme/api`,
// il cesserait d'être un produit frère pour devenir un consommateur de l'autre — et Prisme, en
// important `@echoppe/*`, deviendrait un Échoppe.
//
// Ce qui reste autorisé, et doit le rester :
//   • `@repo/*`        — le socle partagé, propriété de personne
//   • scopes neutres   — un artefact agnostique publié (ADR-0033), consommable par les deux
//   • dépendances tierces
//
// DÉFINITION D'UN PRODUIT : un scope npm possédant au moins une application dans `apps/`. Un
// produit se déploie. Un scope qui ne livre aucune application est un espace de noms, pas un
// produit — ce qui laisse un artefact neutre hors de la garde, sans exception codée en dur.

import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const SHARED_SCOPE = 'repo';
const SCANNED = new Glob('**/*.{ts,tsx,vue,astro,mjs}');
// Un spécificateur de module, et lui seul — cf. `importedModules`.
const SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"]([^'"]+)['"]/g;

type Workspace = {
  readonly dir: string;
  readonly name: string;
  readonly scope: string | null;
  readonly isApp: boolean;
  readonly dependencies: readonly string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dependencyNames(manifest: Record<string, unknown>): readonly string[] {
  const fields = ['dependencies', 'devDependencies', 'peerDependencies'] as const;
  return fields.flatMap((field) => (isRecord(manifest[field]) ? Object.keys(manifest[field]) : []));
}

function scopeOf(name: string): string | null {
  return name.startsWith('@') ? name.slice(1, name.indexOf('/')) : null;
}

function workspaces(): readonly Workspace[] {
  const rootManifest: unknown = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const patterns =
    isRecord(rootManifest) && Array.isArray(rootManifest.workspaces)
      ? rootManifest.workspaces.filter((p): p is string => typeof p === 'string')
      : [];

  const found: Workspace[] = [];
  for (const pattern of patterns) {
    for (const hit of new Glob(`${pattern}/package.json`).scanSync({ cwd: ROOT, onlyFiles: true })) {
      const manifest: unknown = JSON.parse(readFileSync(join(ROOT, hit), 'utf8'));
      if (!isRecord(manifest)) continue;
      const dir = dirname(hit);
      const name = typeof manifest.name === 'string' ? manifest.name : dir;
      found.push({
        dir,
        name,
        scope: scopeOf(name),
        isApp: dir.startsWith('apps/'),
        dependencies: dependencyNames(manifest),
      });
    }
  }
  return found;
}

/** Le produit propriétaire d'un workspace : son scope, ou le produit que son `create-` scaffolde. */
function ownerOf(ws: Workspace, products: ReadonlySet<string>): string | null {
  if (ws.scope === SHARED_SCOPE) return null;
  if (ws.scope !== null && products.has(ws.scope)) return ws.scope;
  if (ws.name.startsWith('create-')) {
    const scaffolded = ws.name.slice('create-'.length);
    return products.has(scaffolded) ? scaffolded : null;
  }
  return null;
}

/**
 * Les modules qu'un fichier IMPORTE réellement.
 *
 * Un `source.includes('@echoppe/')` aurait suffi tant que la garde ne tournait pas : elle sort en
 * succès silencieux avec un seul produit, et personne n'a vu qu'elle lisait du texte, pas du code.
 * Sa toute première exécution réelle a échoué sur un COMMENTAIRE de `prisme-api` qui citait
 * `@echoppe/core` pour dire pourquoi il ne s'en servait pas — exactement la phrase qu'on veut
 * pouvoir écrire.
 *
 * Une garde qui interdit de NOMMER l'autre produit interdit d'expliquer la frontière. Elle lit donc
 * les spécificateurs de module, et rien d'autre : `from '…'`, `import '…'`, `import('…')`,
 * `require('…')`. Ce qui est cité en prose ne la concerne pas ; ce qui est chargé au runtime, si.
 */
function importedModules(source: string): readonly string[] {
  const found: string[] = [];
  for (const match of source.matchAll(SPECIFIER)) {
    const specifier = match[1];
    if (specifier !== undefined) found.push(specifier);
  }
  return found;
}

const all = workspaces();
const products = new Set(
  all.flatMap((w) =>
    w.isApp && w.scope !== null && w.scope !== SHARED_SCOPE ? [w.scope] : [],
  ),
);

if (products.size < 2) {
  console.log(`✓ ${products.size} produit(s) — pas de frontière à garder pour l'instant.`);
  process.exit(0);
}

type Violation = { readonly where: string; readonly owner: string; readonly foreign: string; readonly detail: string };
const violations: Violation[] = [];

for (const ws of all) {
  const owner = ownerOf(ws, products);
  if (owner === null) continue;
  const foreigners = [...products].filter((p) => p !== owner);

  // 1. Dépendances DÉCLARÉES.
  for (const dependency of ws.dependencies) {
    const scope = scopeOf(dependency);
    if (scope !== null && foreigners.includes(scope)) {
      violations.push({
        where: `${ws.dir}/package.json`,
        owner,
        foreign: scope,
        detail: `dépendance déclarée \`${dependency}\``,
      });
    }
  }

  // 2. Imports RÉELS — une dépendance non déclarée résout quand même par hoisting.
  for (const hit of SCANNED.scanSync({ cwd: join(ROOT, ws.dir), onlyFiles: true })) {
    if (hit.includes('node_modules') || hit.includes('dist/')) continue;
    const source = readFileSync(join(ROOT, ws.dir, hit), 'utf8');
    for (const specifier of importedModules(source)) {
      const foreign = scopeOf(specifier);
      if (foreign !== null && foreigners.includes(foreign)) {
        violations.push({
          where: `${ws.dir}/${hit}`,
          owner,
          foreign,
          detail: `importe \`${specifier}\``,
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error('✗ Isolation des produits rompue :\n');
  for (const v of violations) {
    console.error(`  ${v.where}`);
    console.error(`    « ${v.owner} » ${v.detail} — qui appartient à « ${v.foreign} ».`);
  }
  console.error('\nDeux produits frères partagent `@repo/*`, jamais leurs propres briques.');
  console.error('Si la brique est réellement commune, elle doit devenir un paquet partagé.');
  process.exit(1);
}

console.log(`✓ Isolation respectée — ${[...products].sort().join(', ')} ne se dépendent pas.`);
