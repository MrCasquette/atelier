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
import { appendFileSync, chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
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
 * Un prérequis du produit : une variable DÉCLARÉE VIDE dans son `.env.<produit>` versionné
 * (ADR-0067). Le fichier porte les défauts qui marchent ; ce qu'il laisse vide est ce que la
 * machine doit fournir.
 *
 * `recipe` vient du marqueur `# @genere <recette>` posé juste au-dessus. Sa présence dit que la
 * valeur n'admet qu'un tirage ARBITRAIRE — personne n'a d'avis dessus, donc on ne demande pas. Son
 * absence dit l'inverse : un choix humain, qu'on refuse plutôt que d'inventer.
 */
type Requirement = {
  readonly name: string;
  readonly recipe: string | null;
};

/** Le marqueur de recette, et une déclaration vide — `FOO=` sans rien après. */
const RECIPE = /^#\s*@genere\s+(\S+)\s*$/;
const EMPTY_DECLARATION = /^([A-Z][A-Z0-9_]*)=\s*$/;

/** Les recettes que le lanceur sait produire. C'est le SEUL endroit qui énumère quoi que ce soit. */
const RECIPES: Readonly<Record<string, () => string>> = {
  'base64:32': () => randomBytes(32).toString('base64'),
};

function envPath(product: Product, local = false): string {
  return join(ROOT, `.env.${product.name}${local ? '.local' : ''}`);
}

/** Les variables qu'un fichier d'environnement renseigne réellement — valeur non vide. */
function filledIn(file: string): ReadonlySet<string> {
  if (!existsSync(file)) return new Set();
  const filled = new Set<string>();
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const [name, ...rest] = line.split('=');
    if (name !== undefined && !name.trimStart().startsWith('#') && rest.join('=').trim() !== '') {
      filled.add(name.trim());
    }
  }
  return filled;
}

/** Ce que le produit déclare exiger, dans l'ordre du fichier. */
function requirements(product: Product): readonly Requirement[] {
  const file = envPath(product);
  if (!existsSync(file)) return [];
  const found: Requirement[] = [];
  let recipe: string | null = null;
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const marker = line.match(RECIPE);
    if (marker) {
      recipe = marker[1] ?? null;
      continue;
    }
    const declaration = line.match(EMPTY_DECLARATION);
    if (declaration?.[1] !== undefined) found.push({ name: declaration[1], recipe });
    if (line.trim() !== '' && !line.trimStart().startsWith('#')) recipe = null;
  }
  return found;
}

/**
 * Garantit ce que le produit exige, AVANT de monter quoi que ce soit — sinon on découvre le manque
 * après avoir migré et peuplé une base, derrière deux surfaces qui tournent quand même.
 *
 * Ce qui se génère est écrit dans le `.local`, JAMAIS dans le fichier versionné, et annoncé : une
 * clé qui apparaît en silence serait pire qu'une clé absente.
 */
function ensureRequirements(product: Product): void {
  const pending = requirements(product).filter((r) => !filledIn(envPath(product, true)).has(r.name));
  if (pending.length === 0) return;

  const undecidable = pending.filter((r) => r.recipe === null || RECIPES[r.recipe] === undefined);
  if (undecidable.length > 0) {
    refuse(
      `\`${product.name}\` exige une valeur que personne ne peut deviner :`,
      undecidable.map((r) => `${r.name} — à renseigner dans .env.${product.name}.local`),
    );
  }

  const local = envPath(product, true);
  if (!existsSync(local)) {
    writeFileSync(
      local,
      `# Surcharges de CE poste (ADR-0065) — ignoré par git. Surcharge \`.env.${product.name}\`.\n\n`,
    );
  }
  chmodSync(local, 0o600);

  for (const { name, recipe } of pending) {
    const generate = recipe === null ? undefined : RECIPES[recipe];
    if (generate === undefined) continue;
    appendFileSync(local, `${name}=${generate()}\n`);
    console.log(`→ ${name} générée (${recipe}) dans .env.${product.name}.local`);
  }
  console.log('  Valeur de DÉVELOPPEMENT : la remplacer rendra illisible ce qu\'elle a chiffré.\n');
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
  ensureRequirements(product);
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

  // Avant la pile, avant les migrations, avant le seed : sinon on découvre le manque une fois la
  // base montée et peuplée, derrière des surfaces qui tournent quand même (ADR-0067).
  ensureRequirements(product);

  await infra(product, ['up', '--detach', '--wait']);
  for (const verb of ['migrate', 'seed']) {
    if (product.dbVerbs.has(verb)) await db(product, verb);
  }

  // Une surface qui meurt arrête les autres. Sans ça, l'API peut refuser de démarrer pendant que le
  // dashboard et la vitrine continuent de servir contre une API absente : l'échec défile, et il ne
  // reste que deux serveurs qui mentent (ADR-0067).
  // Seule la PREMIÈRE défaillance s'annonce : les suivantes sont les surfaces que la cascade vient
  // d'arrêter, et les faire parler ferait passer une conséquence pour une seconde panne.
  let cause: number | null = null;
  const running = surfaces.map(async (name) => {
    const dir = product.surfaces.get(name);
    if (dir === undefined) throw new Error(`surface \`${name}\` perdue entre la garde et le lancement`);
    const code = await run(['bun', 'run', '--cwd', dir, 'dev']);
    if (code !== 0 && cause === null) {
      cause = code;
      console.error(`\n✗ La surface \`${name}\` s'est arrêtée (code ${code}) — les autres suivent.\n`);
      stopChildren();
    }
    return code;
  });
  await Promise.all(running);
  stopChildren();
  // Le code de sortie est celui de la CAUSE, jamais le `143` d'une surface que la cascade a
  // arrêtée : c'est ce que lira un appelant, et une conséquence n'y apprendrait rien.
  if (cause !== null) process.exit(cause);
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
