#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { cancel, confirm, intro, isCancel, note, outro, spinner, text } from '@clack/prompts';

const DEFAULT_NAME = 'ma-boutique';
const DEFAULT_API_URL = 'http://localhost:8100';
const NAME_PATTERN = /^[a-z0-9-]+$/;

const templateDir = resolve(dirname(fileURLToPath(import.meta.url)), '../template');

function bail(message: string): never {
  cancel(message);
  process.exit(1);
}

/** Contenu du .env généré : front + backend (compose), clé de chiffrement incluse. */
function buildEnv(projectName: string, apiUrl: string, encryptionKey: string): string {
  return `# ─── Docker Compose ─────────────────────────────────────────────────────
# Préfixe des conteneurs/réseau/volumes (noms propres, sans suffixe « -1 »).
COMPOSE_PROJECT_NAME=${projectName}

# ─── Front (Astro + SDK) ────────────────────────────────────────────────
# URL de l'API interrogée par la boutique (SSR + images).
PUBLIC_API_URL=${apiUrl}

# ─── Contenu (\`pnpm content:push\`) ──────────────────────────────────────
# Clé d'API machine (scope write:schema) pour synchroniser vos définitions de
# blocs vers l'API. Créez-la dans l'admin (« Clés d'API »), ou via :
#   docker compose exec api ./api api-key:create --name front --scopes write:schema
# puis collez-la ci-dessous.
CONTENT_API_KEY=

# ─── Version des images Échoppe (backend, cf. compose.yaml) ─────────────
ECHOPPE_VERSION=latest

# ─── Base de données ────────────────────────────────────────────────────
POSTGRES_USER=echoppe
POSTGRES_PASSWORD=echoppe
POSTGRES_DB=echoppe

# ─── Port exposé sur l'hôte ────────────────────────────────────────────
# Un seul : le dashboard est servi par l'API sous /-/admin.
API_PORT=8100

# URL publique du front, transmise à l'API (CORS / liens absolus).
STORE_URL=http://localhost:4321

# Clé de chiffrement — générée automatiquement, gardez-la secrète.
ENCRYPTION_KEY=${encryptionKey}
`;
}

// Runtime qui exécutera `content push` (charge le src/content/*.ts du dev). On détecte au moment
// du scaffold via l'user-agent du PM (npm_config_user_agent) et process.versions :
//   - Bun ou Node ≥ 24 → TS natif, aucun outil ;
//   - Node plus ancien → `npx tsx` à la volée (repli legacy, rien à installer).
// Le script généré reste éditable si le dev change de runtime plus tard.
function detectPushRunner(): string {
  const userAgent = process.env.npm_config_user_agent ?? '';
  if (userAgent.startsWith('bun') || process.versions.bun) return 'bun';
  if (Number(process.versions.node.split('.')[0]) >= 24) return 'node';
  return 'npx tsx';
}

interface TemplatePkg {
  name: string;
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
  [key: string]: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTemplatePkg = (value: unknown): value is TemplatePkg =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  isRecord(value.scripts) &&
  isRecord(value.devDependencies);

/** Copie le template et le personnalise (nom du projet + URL de l'API + .env). */
async function scaffold(projectName: string, apiUrl: string, targetDir: string): Promise<void> {
  await cp(templateDir, targetDir, { recursive: true });
  // npm supprime les .gitignore des paquets : le template le livre sous _gitignore.
  await rename(join(targetDir, '_gitignore'), join(targetDir, '.gitignore'));

  const pkgPath = join(targetDir, 'package.json');
  // Le template est livré avec le paquet, mais il est lu depuis le disque : un fichier tronqué à
  // l'installation ferait échouer le scaffolding trois lignes plus bas, sur une propriété absente.
  const parsed: unknown = JSON.parse(await readFile(pkgPath, 'utf8'));
  if (!isTemplatePkg(parsed)) {
    throw new Error(`Template corrompu : ${pkgPath} n'a pas la forme attendue.`);
  }
  const pkg = parsed;
  pkg.name = projectName;
  // Outillage de contenu : dépendance + commandes de synchronisation (push) et de vérification de
  // dérive (check, à brancher en CI / pre-build). Le typage du front, lui, est inféré côté source.
  const runner = detectPushRunner();
  pkg.devDependencies['@mrcasquette/content'] = 'latest';
  pkg.scripts['content:push'] = `${runner} node_modules/@mrcasquette/content/dist/cli.js push`;
  pkg.scripts['content:check'] = `${runner} node_modules/@mrcasquette/content/dist/cli.js check`;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  const encryptionKey = randomBytes(32).toString('base64');
  await writeFile(join(targetDir, '.env'), buildEnv(projectName, apiUrl, encryptionKey));
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      api: { type: 'string' },
      yes: { type: 'boolean', short: 'y' },
    },
  });

  intro('create-echoppe — nouvelle boutique Astro');

  // Nom du projet : positionnel, sinon prompt.
  let projectName = positionals[0]?.trim();
  if (!projectName) {
    const answer = await text({
      message: 'Nom du projet ?',
      placeholder: DEFAULT_NAME,
      defaultValue: DEFAULT_NAME,
      validate: (value) => {
        const name = (value ?? '').trim();
        if (name && !NAME_PATTERN.test(name)) return 'Minuscules, chiffres et tirets uniquement.';
        return undefined;
      },
    });
    if (isCancel(answer)) bail('Génération annulée.');
    projectName = answer.trim() || DEFAULT_NAME;
  }
  if (!NAME_PATTERN.test(projectName)) {
    bail(`Nom invalide « ${projectName} » : minuscules, chiffres et tirets uniquement.`);
  }

  // URL de l'API : flag --api, sinon prompt.
  let apiUrl = values.api?.trim();
  if (!apiUrl) {
    const answer = await text({
      message: "URL de l'API Échoppe ?",
      placeholder: DEFAULT_API_URL,
      defaultValue: DEFAULT_API_URL,
    });
    if (isCancel(answer)) bail('Génération annulée.');
    apiUrl = answer.trim() || DEFAULT_API_URL;
  }
  apiUrl = apiUrl.replace(/\/+$/, '');

  const targetDir = resolve(process.cwd(), projectName);
  if (existsSync(targetDir)) {
    bail(`Le dossier « ${projectName} » existe déjà.`);
  }

  // Confirmation (sautée avec --yes, pour l'usage non-interactif / CI).
  if (!values.yes) {
    const proceed = await confirm({
      message: `Créer la boutique dans ./${projectName} (API : ${apiUrl}) ?`,
    });
    if (isCancel(proceed) || !proceed) bail('Génération annulée.');
  }

  const progress = spinner();
  progress.start('Génération du projet');
  await scaffold(projectName, apiUrl, targetDir);
  progress.stop('Projet généré');

  note(
    [
      `cd ${projectName}`,
      '',
      '# Backend (API + DB)',
      'docker compose up -d',
      '',
      '# Créez le compte propriétaire (e-mail + mot de passe demandés)',
      'docker compose exec -it api ./api admin:create',
      `# Administration : ${apiUrl}/-/admin`,
      '',
      '# Front Astro',
      'pnpm install',
      'pnpm dev',
      '',
      "# Contenu : créez une clé (admin « Clés d'API »), collez-la dans .env,",
      "# puis synchronisez vos blocs vers l'API",
      'pnpm content:push',
    ].join('\n'),
    'Prochaines étapes',
  );
  outro('Boutique prête. Bon commerce ✦');
}

main().catch((error) => bail(error instanceof Error ? error.message : String(error)));
