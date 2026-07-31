// Entrée CLI de `@mrcasquette/content`. Exécutée par un runtime qui gère le TS — Bun, ou `tsx` à la
// volée (`npx tsx` / `pnpm dlx tsx`), cf. les scripts `content:push` / `content:check` scaffoldés
// par create-echoppe. Elle N'EST PAS un `bin` node (un shim node ne saurait importer le `.ts` de
// config du dev).
//
//   ECHOPPE_API_KEY=eck_… PUBLIC_API_URL=http://localhost:7532  <runtime> cli.js push
//   ECHOPPE_API_KEY=eck_… PUBLIC_API_URL=http://localhost:7532  <runtime> cli.js check

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkRegistry, pushRegistry } from './sync.js';
import type { ContentDefinition } from './types.js';

// Charge le point d'entrée de contenu du dev (défaut : src/content/index.ts). Le runtime TS
// (Bun/tsx) résout et transpile ce `.ts` — d'où l'absence de loader embarqué.
async function loadContent(): Promise<ContentDefinition> {
  const configPath = resolve(
    process.cwd(),
    process.env.ECHOPPE_CONTENT_CONFIG ?? 'src/content/index.ts',
  );
  const mod = await import(pathToFileURL(configPath).href);
  const content = mod.default;
  if (content?.kind !== 'content' || !Array.isArray(content.sections)) {
    throw new Error(`${configPath} doit exporter par défaut un defineContent(...).`);
  }
  return content;
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function readEnv(): { apiUrl: string; apiKey: string } {
  const apiUrl = process.env.PUBLIC_API_URL ?? process.env.API_URL;
  const apiKey = process.env.ECHOPPE_API_KEY;
  if (!apiUrl) fail('PUBLIC_API_URL (ou API_URL) manquant dans l’environnement.');
  if (!apiKey) fail('ECHOPPE_API_KEY manquant dans l’environnement.');
  return { apiUrl, apiKey };
}

// `push` : sérialise + pousse le registre (remplace-tout). Scope requis : write:content.
async function runPush(): Promise<never> {
  const { apiUrl, apiKey } = readEnv();
  const content = await loadContent();
  const result = await pushRegistry(content, { apiUrl, apiKey });
  if (result.ok) {
    console.log('✓ Registre de contenu synchronisé.');
    process.exit(0);
  }
  fail(
    `Échec de la synchronisation (${result.status})${result.message ? ` : ${result.message}` : ''}`,
  );
}

// `check` : compare le registre local au déployé, SANS écrire. Garde-fou anti-dérive (CI, pre-build).
// Sort en 1 si divergent → oubli de `content:push`. Scope requis : read:content.
async function runCheck(): Promise<never> {
  const { apiUrl, apiKey } = readEnv();
  const content = await loadContent();
  const result = await checkRegistry(content, { apiUrl, apiKey });
  if (!result.ok) {
    fail(
      `Échec de la vérification (${result.status})${result.message ? ` : ${result.message}` : ''}`,
    );
  }
  if (result.synced) {
    console.log('✓ Registre local synchronisé avec l’API.');
    process.exit(0);
  }
  fail('Registre local différent du registre déployé. Lancez « content push » pour synchroniser.');
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'push') return void (await runPush());
  if (command === 'check') return void (await runCheck());
  fail('Usage : content <push|check>');
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
