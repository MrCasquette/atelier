#!/usr/bin/env bun
/**
 * Lance le smoke test storefront (tests/storefront-smoke.test.ts) contre une base
 * JETABLE.
 *
 * - Si SMOKE_DATABASE_URL est défini (CI, service Postgres), on l'utilise.
 * - Sinon, on provisionne un conteneur Postgres éphémère sur un port libre, détruit en
 *   fin de run.
 *
 * On N'utilise JAMAIS le DATABASE_URL ambiant : Bun auto-charge `.env`, qui pointe la
 * base de dev — la migrer/seed serait destructeur (cf. docs-internal/release/release-runbook.md).
 * Le DATABASE_URL passé au sous-process est explicite et écrase celui du `.env`, et le
 * test refuse de tourner sans le drapeau ECHOPPE_SMOKE posé ici.
 */
import { spawn } from 'node:child_process';

const CONTAINER = 'echoppe-api-smoke';
const PORT = 5434;

function run(cmd: string, args: string[], env?: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env: env ?? process.env });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

function runQuiet(cmd: string, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args);
    let out = '';
    child.stdout?.on('data', (d) => {
      out += d.toString();
    });
    child.stderr?.on('data', (d) => {
      out += d.toString();
    });
    child.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

async function waitReady(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const { code } = await runQuiet('docker', [
      'exec',
      CONTAINER,
      'pg_isready',
      '-U',
      'echoppe',
      '-d',
      'echoppe',
    ]);
    if (code === 0) return;
    await Bun.sleep(500);
  }
  throw new Error('Postgres éphémère non prêt à temps.');
}

function runTest(databaseUrl: string): Promise<number> {
  // DATABASE_URL explicite (écrase le .env auto-chargé par Bun) + drapeau attendu par le test.
  return run('bun', ['test', 'tests/'], {
    ...process.env,
    DATABASE_URL: databaseUrl,
    ECHOPPE_SMOKE: '1',
  });
}

async function main(): Promise<number> {
  // On ignore volontairement DATABASE_URL ambiant (Bun le charge depuis .env = base de dev).
  const provided = process.env.SMOKE_DATABASE_URL;
  if (provided) {
    console.log('→ SMOKE_DATABASE_URL fourni, run direct.');
    return runTest(provided);
  }

  console.log(`→ provisionne un Postgres éphémère (${CONTAINER}:${PORT})…`);
  await runQuiet('docker', ['rm', '-f', CONTAINER]);
  const { code: runCode, out } = await runQuiet('docker', [
    'run',
    '-d',
    '--name',
    CONTAINER,
    '-e',
    'POSTGRES_USER=echoppe',
    '-e',
    'POSTGRES_PASSWORD=echoppe',
    '-e',
    'POSTGRES_DB=echoppe',
    '-p',
    `${PORT}:5432`,
    'postgres:17-alpine',
  ]);
  if (runCode !== 0) {
    console.error(out);
    return runCode;
  }

  try {
    await waitReady();
    return await runTest(`postgresql://echoppe:echoppe@localhost:${PORT}/echoppe`);
  } finally {
    console.log('→ nettoyage du conteneur éphémère.');
    await runQuiet('docker', ['rm', '-f', CONTAINER]);
  }
}

process.exit(await main());
