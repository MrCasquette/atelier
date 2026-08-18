#!/usr/bin/env bun
/**
 * Régénère le contrat figé (`openapi.json`) puis les types TypeScript.
 *
 * 1. Récupère le spec OpenAPI de l'API en cours d'exécution.
 * 2. Filtre sur la surface storefront + tree-shake, puis le fige dans `openapi.json`.
 * 3. Génère `src/openapi.ts` depuis ce snapshot (pas l'URL → déterministe).
 * 4. Génère `src/models.ts` : des alias plats des schémas, importables directement
 *    (`import type { ProductDetail } from '@echoppe/client'`).
 *
 * Usage : `bun run generate` (API source par défaut sur http://localhost:8101),
 * ou `CONTRACT_API_URL=https://api.exemple.fr bun run generate`.
 */
import { $ } from 'bun';
import { FACADE_SKIP_TAGS, METHOD_NAMES, TAG_NAMESPACE } from './facade-map';
import { filterStorefront, type OpenApiSpec } from './filter';
import { type HttpMethod, STOREFRONT_SURFACE } from './storefront-surface';

const REF_PREFIX = '#/components/schemas/';

// Normalise les schémas RÉCURSIFS (TypeBox `t.Recursive` → nœud `{$id}` + self-`$ref: "<id>"`).
// Tel quel, openapi-typescript prend le `$ref` brut pour un fichier (ENOENT). On hisse chaque nœud
// `$id` en `components.schemas[<id>]` et on réécrit les `$ref` bruts en pointeurs `#/…` résolvables.
function normalizeRecursiveSchemas(spec: OpenApiSpec): number {
  const schemas = spec.components?.schemas;
  if (!schemas) return 0;

  // 1. Cibles des `$ref` BRUTS (ni pointeur `#/…`, ni URL) = schémas auto-référencés à hisser.
  //    (TypeBox pose des `$id` un peu partout ; on ne touche QUE ceux réellement référencés.)
  const refTargets = new Set<string>();
  const collectRefs = (node: unknown): void => {
    if (Array.isArray(node)) return void node.forEach(collectRefs);
    if (!node || typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(rec)) {
      if (
        key === '$ref' &&
        typeof value === 'string' &&
        !value.startsWith('#/') &&
        !value.includes('://')
      ) {
        refTargets.add(value);
      } else {
        collectRefs(value);
      }
    }
  };
  collectRefs(spec.paths);
  collectRefs(schemas);
  if (refTargets.size === 0) return 0;

  // 2. Hisse en composant nommé chaque nœud `$id` ciblé (première occurrence).
  const registered = new Set<string>();
  const hoist = (node: unknown): void => {
    if (Array.isArray(node)) return void node.forEach(hoist);
    if (!node || typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;
    if (typeof rec.$id === 'string' && refTargets.has(rec.$id) && !registered.has(rec.$id)) {
      registered.add(rec.$id);
      schemas[rec.$id] = structuredClone(rec);
    }
    for (const value of Object.values(rec)) hoist(value);
  };
  hoist(spec.paths);
  hoist({ ...schemas });

  // 3. Réécrit les `$ref` bruts ciblés en pointeurs, et retire les `$id` résiduels correspondants.
  const rewrite = (node: unknown): void => {
    if (Array.isArray(node)) return void node.forEach(rewrite);
    if (!node || typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;
    if (typeof rec.$id === 'string' && refTargets.has(rec.$id)) delete rec.$id;
    for (const [key, value] of Object.entries(rec)) {
      if (key === '$ref' && typeof value === 'string' && refTargets.has(value))
        rec[key] = REF_PREFIX + value;
      else rewrite(value);
    }
  };
  rewrite(spec.paths);
  rewrite(schemas);

  return registered.size;
}

// Défaut = API dev *depuis les sources* (rang 1, :8101), pas le conteneur Docker
// (rang 0, :8100). Override par CONTRACT_API_URL pour viser une API distante.
const apiUrl = (process.env.CONTRACT_API_URL ?? 'http://localhost:8101').replace(/\/+$/, '');
const specUrl = `${apiUrl}/-/docs/json`;

const response = await fetch(specUrl);
if (!response.ok) {
  throw new Error(`Récupération du spec OpenAPI échouée : ${response.status} sur ${specUrl}`);
}

// Le contrat de l'API décrit TOUTES les routes (admin + boutique). Le SDK boutique ne doit
// exposer que la surface storefront → on filtre + tree-shake avant de figer.
const fullSpec = (await response.json()) as OpenApiSpec;
const { spec, missing, keptPaths, keptSchemas } = filterStorefront(fullSpec, STOREFRONT_SURFACE);

const recursiveCount = normalizeRecursiveSchemas(spec);
if (recursiveCount > 0) {
  console.log(`✓ ${recursiveCount} schéma(s) récursif(s) normalisé(s) en composants`);
}

if (missing.length > 0) {
  console.warn(`⚠ ${missing.length} route(s) de la surface absente(s) du contrat (dérive ?) :`);
  for (const m of missing) console.warn(`   - ${m}`);
}

await Bun.write('openapi.json', `${JSON.stringify(spec, null, 2)}\n`);
console.log(`✓ openapi.json figé (boutique : ${keptPaths} routes, ${keptSchemas} schémas)`);

await $`bunx openapi-typescript openapi.json -o src/openapi.ts`;
console.log('✓ src/openapi.ts généré');

// Barrel d'alias plats : chaque schéma nommé devient un type importable directement,
// sans passer par l'indexation `components['schemas']['X']`.
const schemaNames = Object.keys(spec.components?.schemas ?? {}).sort();
const models = [
  '// Généré par scripts/generate.ts — NE PAS ÉDITER À LA MAIN.',
  '// Alias plats des schémas du contrat (surface boutique), importables directement :',
  "//   import type { ProductDetail } from '@echoppe/client';",
  '',
  "import type { components } from './openapi.js';",
  '',
  ...schemaNames.map((name) => `export type ${name} = components['schemas']['${name}'];`),
  '',
].join('\n');
await Bun.write('src/models.ts', models);
console.log(`✓ src/models.ts généré (${schemaNames.length} alias plats)`);

// ── Façade ressource (src/facade.ts) : namespaces à plat mappés sur le contrat ──────────
// Chaque opération → une méthode typée qui délègue au client brut. La forme (namespace + nom)
// vient de facade-map.ts ; toute opération non mappée (hors tags ignorés) est signalée.

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

type FacadeMethod = { fn: string; method: HttpMethod; path: string; required: boolean };
const namespaces = new Map<string, FacadeMethod[]>();
const facadeMissing: string[] = [];

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

for (const [path, item] of Object.entries(spec.paths)) {
  for (const method of HTTP_METHODS) {
    const op = asRecord(item)[method];
    if (!op) continue;
    const opRec = asRecord(op);
    const tag = (opRec.tags as string[] | undefined)?.[0];
    if (tag && FACADE_SKIP_TAGS.includes(tag)) continue;

    const ns = tag ? TAG_NAMESPACE[tag] : undefined;
    const operationId = opRec.operationId as string | undefined;
    const fn = operationId ? METHOD_NAMES[operationId] : undefined;
    if (!ns || !fn) {
      facadeMissing.push(
        `${method.toUpperCase()} ${path} (op=${operationId ?? '?'}, tag=${tag ?? '?'})`,
      );
      continue;
    }

    const params = (opRec.parameters as Array<Record<string, unknown>> | undefined) ?? [];
    const requiredQuery = params.some((p) => p.in === 'query' && p.required);
    const required = path.includes('{') || Boolean(opRec.requestBody) || requiredQuery;

    let bucket = namespaces.get(ns);
    if (!bucket) {
      bucket = [];
      namespaces.set(ns, bucket);
    }
    bucket.push({ fn, method, path, required });
  }
}

if (facadeMissing.length > 0) {
  console.warn(
    `⚠ ${facadeMissing.length} opération(s) non mappée(s) dans la façade (facade-map.ts) :`,
  );
  for (const m of facadeMissing) console.warn(`   - ${m}`);
}
for (const [ns, methods] of namespaces) {
  const seen = new Set<string>();
  for (const m of methods) {
    if (seen.has(m.fn)) console.warn(`⚠ collision de méthode dans la façade : ${ns}.${m.fn}`);
    seen.add(m.fn);
  }
}

const facadeLines: string[] = [
  '// Généré par scripts/generate.ts — NE PAS ÉDITER À LA MAIN.',
  '// Façade ressource : namespaces à plat au-dessus du contrat storefront. Chaque méthode',
  '// délègue au client brut openapi-fetch (accessible séparément via `echoppe.raw`).',
  '',
  "import type { Client, MaybeOptionalInit } from 'openapi-fetch';",
  "import type { paths } from './openapi.js';",
  '',
  'export function createResources(client: Client<paths>) {',
  '  return {',
];
for (const [ns, methods] of [...namespaces].sort((a, b) => a[0].localeCompare(b[0]))) {
  facadeLines.push(`    ${ns}: {`);
  for (const m of methods.sort((a, b) => a.fn.localeCompare(b.fn))) {
    const initType = `MaybeOptionalInit<paths['${m.path}'], '${m.method}'>`;
    const param = m.required ? `init: ${initType}` : `init?: ${initType}`;
    facadeLines.push(
      `      ${m.fn}: (${param}) => client.${m.method.toUpperCase()}('${m.path}', init),`,
    );
  }
  facadeLines.push('    },');
}
facadeLines.push('  };', '}', '');
await Bun.write('src/facade.ts', `${facadeLines.join('\n')}`);
console.log(`✓ src/facade.ts généré (${namespaces.size} namespaces)`);
