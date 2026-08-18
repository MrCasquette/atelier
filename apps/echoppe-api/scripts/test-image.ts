#!/usr/bin/env bun
/**
 * Exerce l'IMAGE PUBLIABLE en base vierge — gate de publication (T2–T5 du brief). Distinct de
 * `test:api`, qui exerce l'API depuis les sources : ici c'est l'artefact qu'on livre.
 *
 * Construit l'image `api` (le Dockerfile réellement publié), la boote contre un Postgres
 * neuf (migrations au boot via RUN_MIGRATIONS), puis :
 *   T2 — smoke storefront : /products/ 200 avec swatches + images, /products/by-slug/{slug}
 *        avec options[].type + values[].metadata, /countries/ non vide.
 *   T4 — parité contrat : le SDK régénéré depuis l'OpenAPI de l'image == SDK committé.
 *   T5 — idempotence : re-boot (migrate rejoué) → healthy, pas de doublon country.
 *   T3 — upgrade : base créée par l'image publiée n-1 (migrations 0000-0005 + journal réel) →
 *        boot de la nouvelle image → migrations forward (0006) → T2.
 *
 * Tout est auto-provisionné (Postgres + image), détruit en fin de run. Utilisable en local
 * et en CI (`bun run test:image`). INTEGRATION_IMAGE réutilise une image
 * déjà buildée (itération locale rapide). PREV_IMAGE = image n-1 pour le test d'upgrade.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { contractTargets } from '../../../scripts/contract-targets';

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

const IMAGE = process.env.INTEGRATION_IMAGE ?? 'echoppe-api:integration';
// n-1 pour l'upgrade : par défaut le `:latest` publié = la version en prod AU MOMENT du gate
// (avant qu'on publie la nouvelle) → teste l'upgrade depuis ce que les boutiques ont réellement.
const PREV_IMAGE = process.env.PREV_IMAGE ?? 'ghcr.io/mrcasquette/echoppe-api:latest';
const NET = 'echoppe-int-net';
const DB_C = 'echoppe-int-db';
const API_C = 'echoppe-int-api';
const DB_HOST_PORT = 5440;
const API_HOST_PORT = 8103; // rang 3 : la pile jetable du gate, jamais celle du produit (ADR-0054)
const API_INTERNAL_PORT = 8100;
const PG_IMAGE = 'postgres:17-alpine';

const hostDbUrl = `postgresql://echoppe:echoppe@localhost:${DB_HOST_PORT}/echoppe`;
const baseUrl = `http://localhost:${API_HOST_PORT}`;

type Sh = { code: number; out: string };

function sh(
  cmd: string,
  args: string[],
  opts: { inheritStdio?: boolean; stdin?: string; env?: NodeJS.ProcessEnv } = {},
) {
  return new Promise<Sh>((resolve) => {
    const child = spawn(cmd, args, {
      cwd: REPO_ROOT,
      env: opts.env ?? process.env,
      stdio: opts.inheritStdio ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout?.on('data', (d) => {
      out += d.toString();
    });
    child.stderr?.on('data', (d) => {
      out += d.toString();
    });
    if (opts.stdin !== undefined) {
      child.stdin?.write(opts.stdin);
      child.stdin?.end();
    }
    child.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

async function docker(args: string[]) {
  return sh('docker', args);
}

function fail(msg: string): never {
  throw new Error(msg);
}

// `-h 127.0.0.1` force le TCP, et ce n'est pas un détail : l'image officielle démarre un serveur
// TEMPORAIRE pendant `initdb`, qui n'écoute QUE la socket Unix. Sans `-h`, `pg_isready` répond 0 sur
// ce serveur-là, on enchaîne, et la première requête tombe sur « the database system is starting up »
// quand le vrai serveur redémarre. Le serveur temporaire n'ouvre jamais le TCP → plus de faux positif.
async function waitPg(container: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const { code } = await docker([
      'exec',
      container,
      'pg_isready',
      '-h',
      '127.0.0.1',
      '-U',
      'echoppe',
      '-d',
      'echoppe',
    ]);
    if (code === 0) return;
    await Bun.sleep(500);
  }
  fail(`Postgres ${container} non prêt.`);
}

// T3 boote l'image n-1, publiée AVANT qu'ADR-0052 ne déplace le healthcheck sous `/-/`. Ce harnais
// croise donc deux générations de surface : il sonde les deux chemins, sinon l'upgrade échoue sur
// une image parfaitement saine. La sonde tombera d'elle-même quand n-1 aura passé la bascule.
const HEALTH_PATHS = ['/-/health', '/health'] as const;

async function waitHealth(): Promise<void> {
  for (let i = 0; i < 90; i++) {
    for (const path of HEALTH_PATHS) {
      try {
        const res = await fetch(`${baseUrl}${path}`);
        if (res.ok) return;
      } catch {
        // pas encore up
      }
    }
    await Bun.sleep(1000);
  }
  fail(`API ${baseUrl} non disponible (${HEALTH_PATHS.join(', ')}).`);
}

async function getJson(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}${path}`);
  const body = res.status === 200 ? await res.json() : null;
  return { status: res.status, body };
}

// ── Provisioning ────────────────────────────────────────────────────────────────────────

async function ensureImage(): Promise<void> {
  if (process.env.INTEGRATION_IMAGE) {
    console.log(`→ image réutilisée : ${IMAGE}`);
    return;
  }
  console.log(`→ build image ${IMAGE} (--target api)…`);
  const { code, out } = await docker(['build', '--target', 'api', '-t', IMAGE, '.']);
  if (code !== 0) {
    console.error(out);
    fail('Build image échoué.');
  }
}

async function teardown(): Promise<void> {
  await docker(['rm', '-f', API_C]);
  await docker(['rm', '-f', DB_C]);
  await docker(['network', 'rm', NET]);
}

async function startDb(): Promise<void> {
  await docker(['rm', '-f', DB_C]);
  const { code, out } = await docker([
    'run',
    '-d',
    '--name',
    DB_C,
    '--network',
    NET,
    '-e',
    'POSTGRES_USER=echoppe',
    '-e',
    'POSTGRES_PASSWORD=echoppe',
    '-e',
    'POSTGRES_DB=echoppe',
    '-p',
    `${DB_HOST_PORT}:5432`,
    PG_IMAGE,
  ]);
  if (code !== 0) {
    console.error(out);
    fail('Démarrage Postgres échoué.');
  }
  await waitPg(DB_C);
}

async function startApi(image: string = IMAGE): Promise<void> {
  await docker(['rm', '-f', API_C]);
  const { code, out } = await docker([
    'run',
    '-d',
    '--name',
    API_C,
    '--network',
    NET,
    '-e',
    `DATABASE_URL=postgresql://echoppe:echoppe@${DB_C}:5432/echoppe`,
    '-e',
    'RUN_MIGRATIONS=1',
    // Clé de test (32 octets base64) — requise par le garde-fou env au boot (apps/echoppe-api/src/env.ts).
    // Fixe → stable entre les boots T2/T3/T5 sur la même base.
    '-e',
    'ENCRYPTION_KEY=ZWNob3BwZS1pbnRlZ3JhdGlvbi10ZXN0LWtleS0zMmI=',
    // Le port interne est IMPOSÉ, jamais supposé : T3 boote l'image n-1, qui peut être d'une
    // génération antérieure à la grille de ports (ADR-0054) et écouter ailleurs par défaut.
    '-e',
    `API_PORT=${API_INTERNAL_PORT}`,
    '-p',
    `${API_HOST_PORT}:${API_INTERNAL_PORT}`,
    image,
  ]);
  if (code !== 0) {
    console.error(out);
    fail(`Démarrage API (${image}) échoué.`);
  }
  await waitHealth();
}

async function seedDemo(): Promise<void> {
  console.log('→ seed démo (produits couleur)…');
  // db:seed lit ../../.env (base de DEV). On force DATABASE_URL vers la base d'intégration :
  // Bun n'écrase pas une variable déjà définie par un .env → l'URL explicite gagne.
  const { code, out } = await sh('bun', ['run', '--cwd', 'packages/echoppe-core', 'db:seed'], {
    env: { ...process.env, DATABASE_URL: hostDbUrl },
  });
  if (code !== 0) {
    console.error(out);
    fail('Seed échoué.');
  }
}

// ── Assertions ──────────────────────────────────────────────────────────────────────────

// Ce script valide une image PUBLIÉE : ce qu'il lit vient d'un conteneur, pas de nos types. Les
// formes attendues se vérifient donc, elles ne s'affirment pas — et `fail` dit déjà comment.
function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${what} : objet attendu, reçu ${JSON.stringify(value)?.slice(0, 200)}`);
  }
  return Object.fromEntries(Object.entries(value));
}

function asRecords(value: unknown, what: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    fail(`${what} : tableau attendu, reçu ${JSON.stringify(value)?.slice(0, 200)}`);
  }
  return value.map((item, index) => asRecord(item, `${what}[${index}]`));
}

async function assertStorefront(label: string): Promise<void> {
  console.log(`→ [${label}] assertions storefront…`);

  const countries = await getJson('/countries/');
  if (countries.status !== 200) fail(`[${label}] /countries/ → ${countries.status}`);
  const clist = asRecords(countries.body, '/countries/');
  if (!clist.some((c) => c.code === 'FR')) {
    fail(`[${label}] /countries/ ne contient pas la France : ${JSON.stringify(clist)}`);
  }

  const products = await getJson('/products/?limit=50');
  if (products.status !== 200) fail(`[${label}] /products/ → ${products.status} (attendu 200)`);
  const plist = asRecord(products.body, '/products/');
  const cards = asRecords(plist.data, '/products/ data');
  if (cards.length === 0) {
    fail(`[${label}] /products/ vide après seed`);
  }
  const meta = asRecord(plist.meta, '/products/ meta');
  if (typeof meta.hasNextPage !== 'boolean' || typeof meta.hasPrevPage !== 'boolean') {
    fail(`[${label}] meta.hasNextPage/hasPrevPage manquants`);
  }

  const withSwatches = cards.find((p) => asRecords(p.swatches, 'swatches').length > 0);
  if (!withSwatches) fail(`[${label}] aucun produit avec swatches non vides`);
  const withImages = cards.find((p) => asRecords(p.images, 'images').length > 0);
  if (!withImages) fail(`[${label}] aucun produit avec images non vides`);

  const detail = await getJson(`/products/by-slug/${withSwatches.slug}`);
  if (detail.status !== 200) fail(`[${label}] /by-slug/${withSwatches.slug} → ${detail.status}`);
  const bySlug = asRecord(detail.body, '/by-slug');
  const colorOpt = asRecords(bySlug.options, 'options').find((o) => o.type === 'color');
  if (!colorOpt) fail(`[${label}] by-slug sans option type=color`);
  if (
    !asRecords(colorOpt.values, 'values').some(
      (v) => v.metadata !== null && v.metadata !== undefined,
    )
  ) {
    fail(`[${label}] by-slug : option couleur sans metadata`);
  }
  console.log(`  ✓ [${label}] /products/ swatches+images, by-slug type/metadata, /countries/ FR`);
}

async function countFrance(): Promise<number> {
  const { out } = await docker([
    'exec',
    DB_C,
    'psql',
    '-U',
    'echoppe',
    '-d',
    'echoppe',
    '-t',
    '-A',
    '-c',
    "SELECT count(*) FROM country WHERE code='FR';",
  ]);
  return Number(out.trim());
}

// T5 — idempotence : re-boot de l'API (migrate rejoué) → healthy + pas de doublon country.
async function assertIdempotence(): Promise<void> {
  console.log('→ [T5] idempotence (re-boot + re-migrate)…');
  const before = await countFrance();
  await docker(['restart', API_C]);
  await waitHealth();
  const after = await countFrance();
  if (before !== 1 || after !== 1) {
    fail(`[T5] doublon country après re-boot (avant=${before}, après=${after})`);
  }
  console.log('  ✓ [T5] re-migrate idempotent, 1 seule France');
}

// T4 — parité contrat : les TYPES du SDK régénérés depuis l'OpenAPI de l'image == types committés.
// On gate sur les fichiers de TYPES (openapi.ts / models.ts / facade.ts) — le contrat réel
// consommé — et NON sur openapi.json : l'émission de `additionalProperties` par TypeBox y varie
// de façon cosmétique (openapi-typescript l'ignore → types identiques). Gater le json produirait
// des faux positifs sans écart de contrat.
async function assertContractParity(): Promise<void> {
  console.log('→ [T4] parité contrat (types SDK == OpenAPI de l’image)…');
  // La cible vient de la DÉCLARATION du client (`contract` dans son package.json), pas d'une liste
  // recopiée ici : le gate de release et la garde CI lisaient deux listes qui pouvaient diverger.
  const target = contractTargets().find((t) => t.source === 'apps/echoppe-api');
  if (!target) {
    fail('[T4] aucun client ne déclare `apps/echoppe-api` comme source de contrat.');
  }
  const typeFiles = [...target.frozen];
  const allGenerated = [`${target.client}/openapi.json`, ...typeFiles];
  // CONTRACT_API_URL vise l'API DU CONTENEUR : sans lui, `generate` retombe sur son défaut
  // (l'API des sources, 8101) et T4 comparerait les types d'une autre API que celle testée.
  const gen = await sh('bun', ['run', '--cwd', target.client, 'generate'], {
    inheritStdio: false,
    env: { ...process.env, CONTRACT_API_URL: baseUrl },
  });
  if (gen.code !== 0) {
    console.error(gen.out);
    fail('[T4] régénération SDK échouée.');
  }
  const diff = await sh('git', ['diff', '--exit-code', '--', ...typeFiles]);
  // Restaure tous les fichiers régénérés (y compris openapi.json non gaté) pour ne pas salir l'arbre.
  await sh('git', ['checkout', '--', ...allGenerated]);
  if (diff.code !== 0) {
    console.error(diff.out);
    fail('[T4] les types de l’image diffèrent du SDK committé — régénérer le SDK.');
  }
  console.log('  ✓ [T4] types SDK == OpenAPI de l’image');
}

// ── Phases ──────────────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  await ensureImage();
  await docker(['network', 'create', NET]);

  try {
    // Phase FRESH (T2, T4, T5) — base vierge.
    await startDb();
    await startApi();
    await seedDemo();
    await assertStorefront('T2 fresh');
    await assertContractParity();
    await assertIdempotence();

    // Phase UPGRADE (T3) — la base n-1 est créée par l'IMAGE PUBLIÉE précédente (migrations
    // 0000-0005 + journal réel), puis la nouvelle image applique 0006 en forward au boot.
    console.log(
      `→ [T3] chemin upgrade (image n-1 ${PREV_IMAGE} → nouvelle image, migrate forward)…`,
    );
    await docker(['rm', '-f', API_C, DB_C]);
    await startDb();
    await docker(['pull', PREV_IMAGE]);
    await startApi(PREV_IMAGE); // n-1 : applique 0000-0005 avec son journal
    await docker(['rm', '-f', API_C]); // on garde la base, on retire l'API n-1
    await startApi(IMAGE); // nouvelle image : applique 0006 en forward
    await seedDemo();
    await assertStorefront('T3 upgrade');

    console.log('\n✅ Intégration image : T2 + T3 + T4 + T5 verts.');
    return 0;
  } finally {
    console.log('→ nettoyage.');
    await teardown();
  }
}

try {
  process.exit(await main());
} catch (err) {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
  await teardown();
  process.exit(1);
}
