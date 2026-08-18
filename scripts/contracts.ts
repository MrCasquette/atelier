#!/usr/bin/env bun
// Régénère les contrats SDK figés depuis les apps pures, et (mode --check) échoue si les fichiers
// de TYPES figés ont bougé — garde anti-dérive, miroir de la garde Drizzle (ci.yml).
//
//   bun run contracts          → régénère
//   bun run contracts --check  → régénère puis `git diff --exit-code` sur les types → CI
//
// On NE garde PAS `openapi.json` : l'émission de `additionalProperties` par TypeBox y varie de façon
// cosmétique (types identiques) → faux positifs. On garde les types dérivés, comme le gate T4.
//
// Multi-produits : les cibles sont DÉCLARÉES par les clients (cf. `contract-targets.ts`), jamais
// énumérées ici. Un second produit doté d'un SDK est gardé sans qu'on touche à ce fichier.
import { $ } from 'bun';
import { join } from 'node:path';
import { contractTargets, ROOT } from './contract-targets';

// Port de travail ÉPHÉMÈRE, jamais un port fixe. Sur un port fixe, une API de dev déjà lancée
// dessus vole la place : le serveur spawné meurt (stderr ignoré), `waitReady` répond OK sur
// l'intrus, et le contrat se régénère depuis le MAUVAIS serveur — en silence.
function freePort(): number {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() });
  const { port } = probe;
  probe.stop(true);
  return port;
}

const CHECK = process.argv.includes('--check');
const PLACEHOLDER_DATABASE_URL = 'postgres://placeholder:placeholder@127.0.0.1:5432/x';

async function waitReady(url: string, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // serveur pas encore prêt
    }
    await Bun.sleep(200);
  }
  throw new Error(`serveur contrat pas prêt sur ${url}`);
}

const targets = contractTargets();

if (targets.length === 0) {
  console.log('⚠ Aucun client ne déclare de `contract` — rien à générer.');
  process.exit(0);
}

for (const target of targets) {
  const port = freePort();

  // App pure offline : DATABASE_URL placeholder (aucune requête n'est exécutée).
  const server = Bun.spawn(['bun', 'run', target.serveContract], {
    cwd: ROOT,
    env: {
      ...process.env,
      API_PORT: String(port),
      DATABASE_URL: process.env.DATABASE_URL ?? PLACEHOLDER_DATABASE_URL,
    },
    stdout: 'ignore',
    stderr: 'ignore',
  });

  try {
    await waitReady(`http://127.0.0.1:${port}/-/docs/json`);
    await $`bun run --cwd ${join(ROOT, target.client)} generate`.env({
      ...process.env,
      CONTRACT_API_URL: `http://127.0.0.1:${port}`,
    });
  } finally {
    server.kill();
  }
}

if (!CHECK) {
  console.log(`✓ ${targets.length} contrat(s) SDK régénéré(s).`);
  process.exit(0);
}

let drifted = false;

for (const target of targets) {
  const diff = (await $`git diff --stat -- ${target.frozen}`.text()).trim();
  if (diff) {
    drifted = true;
    console.error(`✗ ${target.client} — types désynchronisés des routes de ${target.source} :`);
    console.error(diff);
  } else {
    console.log(`✓ ${target.client} — types figés == routes (${target.source})`);
  }
}

if (drifted) {
  console.error('\nLancer `bun run contracts` puis committer les `src/*.ts` + `openapi.json` produits.');
  process.exit(1);
}

console.log(`\n${targets.length} contrat(s) à jour.`);
