#!/usr/bin/env bun
// Régénère le contrat SDK figé depuis l'app pure, et (mode --check) échoue si les fichiers de TYPES
// figés ont bougé — garde anti-dérive, miroir de la garde Drizzle (ci.yml).
//
//   bun run contracts          → régénère (remplace le boot manuel de l'API + generate)
//   bun run contracts --check  → régénère puis `git diff --exit-code` sur les types → CI
//
// On NE garde PAS `openapi.json` : l'émission de `additionalProperties` par TypeBox y varie de façon
// cosmétique (types identiques) → faux positifs. On garde les types dérivés, comme le gate T4.
import { $ } from 'bun';

// Port de travail ÉPHÉMÈRE, jamais un port fixe. Sur un port fixe, une API de dev déjà lancée
// dessus vole la place : le serveur spawné meurt (stderr ignoré), `waitReady` répond OK sur
// l'intrus, et le contrat se régénère depuis le MAUVAIS serveur — en silence.
function freePort(): number {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() });
  const { port } = probe;
  probe.stop(true);
  return port;
}

const PORT = freePort();
const CHECK = process.argv.includes('--check');
const TYPE_FILES = [
  'packages/client/src/openapi.ts',
  'packages/client/src/models.ts',
  'packages/client/src/facade.ts',
];

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

// App pure offline : DATABASE_URL placeholder (aucune requête n'est exécutée, cf. serve-contract.ts).
const server = Bun.spawn(['bun', 'run', 'apps/echoppe-api/src/scripts/serve-contract.ts'], {
  env: {
    ...process.env,
    API_PORT: String(PORT),
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://placeholder:placeholder@127.0.0.1:5432/x',
  },
  stdout: 'ignore',
  stderr: 'ignore',
});

try {
  await waitReady(`http://127.0.0.1:${PORT}/docs/json`);
  await $`bun run --cwd packages/client generate`.env({
    ...process.env,
    ECHOPPE_API_URL: `http://127.0.0.1:${PORT}`,
  });
} finally {
  server.kill();
}

if (!CHECK) {
  console.log('✓ Contrat SDK régénéré.');
  process.exit(0);
}

const diff = (await $`git diff --stat -- ${TYPE_FILES}`.text()).trim();
if (diff) {
  console.error('✗ Contrat SDK périmé — types désynchronisés des routes :');
  console.error(diff);
  console.error("\nLancer `bun run contracts` puis committer packages/client/src/*.ts + openapi.json.");
  process.exit(1);
}
console.log('✓ Contrat SDK à jour (types figés == routes).');
