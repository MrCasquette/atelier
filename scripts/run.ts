#!/usr/bin/env bun
// Le lanceur du dépôt. Quatre verbes, et chacun nomme son produit (ADR-0066).
//
//   bun run dev echoppe            la pile, les migrations, le seed, puis toutes les surfaces
//   bun run dev echoppe api        une seule surface, la pile et la base quand même
//   bun run db prisme migrate      un verbe de schéma, sur la base de CE produit
//   bun run infra echoppe down     tout ce que `docker compose` sait faire, au bon endroit
//   bun run integration echoppe image
//
// INVARIANT : ce qui exécute un produit le nomme, ce qui vérifie le dépôt n'en nomme aucun. `lint`,
// `type-check`, `test`, les gardes et `contracts:check` restent sans produit — ils n'ont jamais eu
// besoin d'une base réelle, et le contributeur médian d'`atelier` travaille sur le socle.
//
// IL DÉCOUVRE, IL N'ÉNUMÈRE PAS — la règle de l'outillage, appliquée au lanceur :
//   • les produits          ← les dossiers `infra/*/compose.yaml`
//   • les surfaces          ← les workspaces `apps/<produit>-*` qui déclarent un script `dev`
//   • les verbes de schéma  ← les scripts `db:*` que déclare `packages/<produit>-core`
//   • les suites            ← les scripts `test:*` que déclare `apps/<produit>-api`
//
// Conséquence : « Prisme n'a pas de seed » n'est écrit nulle part, c'est une lecture. Le jour où
// `prisme-core` en déclare un, la ligne apparaît sans que personne touche à ce fichier.
//
// UN REFUS QUI LISTE, JAMAIS UN ASSISTANT INTERACTIF. Une commande incomplète qui « marche » entre
// dans les READMEs et dans les habitudes — c'est le produit implicite qu'on vient de supprimer. Et
// un assistant ne fonctionne pas sans TTY : il faudrait écrire les deux chemins pour n'en servir
// qu'un. Le dépôt refuse et nomme partout ailleurs ; ce lanceur fait pareil.

import { Glob } from 'bun';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');

type Product = {
  readonly name: string;
  /** Le dossier de la pile, qui donne aussi son nom au projet Compose. */
  readonly infraDir: string;
  /** Nom du script dans le workspace → chemin du workspace. */
  readonly surfaces: ReadonlyMap<string, string>;
  readonly dbVerbs: ReadonlyMap<string, string>;
  readonly suites: ReadonlyMap<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Les scripts déclarés par un workspace, ou rien si le workspace n'existe pas. */
function scriptsOf(dir: string): readonly string[] {
  const manifest = join(ROOT, dir, 'package.json');
  if (!existsSync(manifest)) return [];
  const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf-8'));
  if (!isRecord(parsed) || !isRecord(parsed.scripts)) return [];
  return Object.keys(parsed.scripts);
}

/**
 * Les scripts d'un workspace qui portent un préfixe, indexés par ce qui suit le préfixe :
 * `db:migrate` → `migrate`. C'est ce qui rend les verbes lisibles plutôt qu'écrits.
 */
function prefixed(dir: string, prefix: string): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  for (const script of scriptsOf(dir)) {
    if (script.startsWith(prefix)) found.set(script.slice(prefix.length), dir);
  }
  return found;
}

/** Les surfaces d'un produit : ses applications qui savent tourner en développement. */
function surfacesOf(product: string): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  for (const manifest of new Glob(`apps/${product}-*/package.json`).scanSync(ROOT)) {
    const dir = dirname(manifest);
    if (scriptsOf(dir).includes('dev')) {
      found.set(basename(dir).slice(product.length + 1), dir);
    }
  }
  return found;
}

/** Les produits du dépôt : ceux qui ont une pile. Un produit sans pile ne s'exécute pas. */
function products(): readonly Product[] {
  const found: Product[] = [];
  for (const file of new Glob('infra/*/compose.yaml').scanSync(ROOT)) {
    const infraDir = dirname(file);
    const name = basename(infraDir);
    found.push({
      name,
      infraDir,
      surfaces: surfacesOf(name),
      dbVerbs: prefixed(`packages/${name}-core`, 'db:'),
      suites: prefixed(`apps/${name}-api`, 'test:'),
    });
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

function refuse(message: string, choices: Iterable<string>): never {
  const listed = [...choices];
  console.error(`\n✗ ${message}\n`);
  if (listed.length > 0) console.error(listed.map((c) => `  ${c}`).join('\n') + '\n');
  process.exit(1);
}

function productNamed(name: string | undefined, verb: string): Product {
  const all = products();
  if (name === undefined) {
    refuse(`\`bun run ${verb}\` veut un produit :`, all.map((p) => `bun run ${verb} ${p.name} …`));
  }
  const found = all.find((p) => p.name === name);
  if (found === undefined) {
    refuse(`Aucun produit \`${name}\`. Le dépôt en connaît :`, all.map((p) => p.name));
  }
  return found;
}

/**
 * Les fichiers de configuration à passer à Compose, et seulement ceux qui existent. Bun ignore un
 * `--env-file` absent, Compose ÉCHOUE dessus (`couldn't find env file`) — mesuré. Sans ce filtre,
 * le `.local` facultatif d'ADR-0065 devrait être obligatoire, donc généré.
 */
function envFlags(product: Product): readonly string[] {
  const candidates = [`.env.${product.name}`, `.env.${product.name}.local`];
  return candidates
    .filter((file) => existsSync(join(ROOT, file)))
    .flatMap((file) => ['--env-file', join(ROOT, file)]);
}

/**
 * Les enfants encore vivants. `Ctrl-C` dans un terminal signale tout le groupe de processus, donc
 * les surfaces s'arrêtent d'elles-mêmes ; ce registre couvre l'autre chemin — une surface qui
 * échoue et fait sortir le lanceur, qui laisserait sinon les autres tourner sans personne pour les
 * arrêter. La pile Compose, elle, n'est jamais touchée : elle survit à la session (ADR-0066).
 */
const children = new Set<Bun.Subprocess>();

function stopChildren(): void {
  for (const child of children) child.kill();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopChildren();
    process.exit(130);
  });
}

async function run(command: readonly string[], cwd = ROOT): Promise<number> {
  const child = Bun.spawn({ cmd: [...command], cwd, stdio: ['inherit', 'inherit', 'inherit'] });
  children.add(child);
  try {
    return await child.exited;
  } finally {
    children.delete(child);
  }
}

async function mustRun(command: readonly string[], cwd = ROOT): Promise<void> {
  const code = await run(command, cwd);
  if (code !== 0) {
    stopChildren();
    process.exit(code);
  }
}

function compose(product: Product, args: readonly string[]): readonly string[] {
  return ['docker', 'compose', ...envFlags(product), ...args];
}

async function infra(product: Product, args: readonly string[]): Promise<void> {
  await mustRun(compose(product, args), join(ROOT, product.infraDir));
}

async function db(product: Product, verb: string): Promise<void> {
  const dir = product.dbVerbs.get(verb);
  if (dir === undefined) {
    refuse(
      `\`${product.name}\` ne déclare pas \`db:${verb}\`. Ce qu'il déclare :`,
      [...product.dbVerbs.keys()].sort().map((v) => `bun run db ${product.name} ${v}`),
    );
  }
  await mustRun(['bun', 'run', '--cwd', dir, `db:${verb}`]);
}

/**
 * Tout ce qu'il faut pour que le produit tourne, faute de quoi le développeur code à l'aveugle.
 *
 * `up` toujours DÉTACHÉ, et `--wait` plutôt qu'une attente écrite ici : une infrastructure est une
 * dépendance de fond, pas quelque chose qu'on regarde. `Ctrl-C` arrête les surfaces et laisse la
 * pile debout — elle survit à la session, et son arrêt reste un geste explicite.
 *
 * `push` n'y entre JAMAIS : sur une base qui porte des entités, il DÉTRUIT leurs tables, que Drizzle
 * ne connaît pas puisqu'elles sont dérivées au push. Celui qui édite un schéma l'appelle sciemment.
 */
async function dev(product: Product, requested: readonly string[]): Promise<void> {
  for (const name of requested) {
    if (!product.surfaces.has(name)) {
      refuse(
        `\`${product.name}\` n'a pas de surface \`${name}\`. Ses surfaces :`,
        [...product.surfaces.keys()].sort(),
      );
    }
  }
  const surfaces = requested.length > 0 ? requested : [...product.surfaces.keys()].sort();
  if (surfaces.length === 0) {
    refuse(`\`${product.name}\` n'a aucune surface qui tourne en développement.`, []);
  }

  await infra(product, ['up', '--detach', '--wait']);
  for (const verb of ['migrate', 'seed']) {
    if (product.dbVerbs.has(verb)) await db(product, verb);
  }

  const running = surfaces.map((name) => {
    const dir = product.surfaces.get(name);
    if (dir === undefined) throw new Error(`surface \`${name}\` perdue entre la garde et le lancement`);
    return run(['bun', 'run', '--cwd', dir, 'dev']);
  });
  const codes = await Promise.all(running);
  stopChildren();
  const failed = codes.find((code) => code !== 0);
  if (failed !== undefined) process.exit(failed);
}

async function integration(product: Product, suite: string | undefined): Promise<void> {
  const dir = suite === undefined ? undefined : product.suites.get(suite);
  if (dir === undefined) {
    if (product.suites.size === 0) {
      refuse(`\`${product.name}\` ne déclare aucune suite d'intégration.`, []);
    }
    refuse(
      suite === undefined
        ? `\`bun run integration ${product.name}\` veut une suite :`
        : `\`${product.name}\` ne déclare pas la suite \`${suite}\`. Ce qu'il déclare :`,
      [...product.suites.keys()].sort().map((s) => `bun run integration ${product.name} ${s}`),
    );
  }
  await mustRun(['bun', 'run', '--cwd', dir, `test:${suite}`]);
}

const [verb, productName, ...rest] = process.argv.slice(2);

switch (verb) {
  case 'dev':
    await dev(productNamed(productName, 'dev'), rest);
    break;
  case 'db': {
    const product = productNamed(productName, 'db');
    const [wanted] = rest;
    if (wanted === undefined) {
      refuse(
        `\`bun run db ${product.name}\` veut un verbe :`,
        [...product.dbVerbs.keys()].sort().map((v) => `bun run db ${product.name} ${v}`),
      );
    }
    await db(product, wanted);
    break;
  }
  case 'infra': {
    const product = productNamed(productName, 'infra');
    if (rest.length === 0) {
      refuse(`\`bun run infra ${product.name}\` veut une commande Compose :`, [
        `bun run infra ${product.name} up --detach`,
        `bun run infra ${product.name} ps`,
        `bun run infra ${product.name} down`,
      ]);
    }
    await infra(product, rest);
    break;
  }
  case 'integration':
    await integration(productNamed(productName, 'integration'), rest[0]);
    break;
  default:
    refuse(verb === undefined ? 'Aucun verbe.' : `Verbe inconnu \`${verb}\`.`, [
      'bun run dev <produit> [surface…]',
      'bun run db <produit> <verbe>',
      'bun run infra <produit> <commande compose…>',
      'bun run integration <produit> <suite>',
    ]);
}
