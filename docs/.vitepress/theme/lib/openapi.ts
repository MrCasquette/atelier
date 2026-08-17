// Logique partagée par les composants de la référence SDK. Le contrat storefront figé
// (`@echoppe/client/openapi.json`) est la SOURCE : ces helpers en extraient les modèles,
// leurs types, un exemple de réponse et l'appel SDK correspondant. Tout suit le contrat.

import contract from '../../../../packages/echoppe-client/openapi.json';
import { METHOD_NAMES, TAG_NAMESPACE } from '../../../../packages/echoppe-client/scripts/facade-map';

export type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  format?: string;
  default?: unknown;
  anyOf?: JsonSchema[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  $id?: string;
  $ref?: string;
};

type Parameter = { name: string; in: string; schema?: JsonSchema };
type Operation = {
  operationId?: string;
  tags?: string[];
  parameters?: Parameter[];
  responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
  requestBody?: { content?: Record<string, { schema?: JsonSchema }> };
};
type Spec = {
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, JsonSchema> };
};

export type Route = { method: string; path: string };

const spec = contract as unknown as Spec;
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

export const schemas: Record<string, JsonSchema> = spec.components?.schemas ?? {};
export const modelNames: string[] = Object.keys(schemas).sort();
const modelSet = new Set(modelNames);

const refName = (ref?: string) => ref?.split('/').pop() ?? null;
export const schemaName = (schema?: JsonSchema) => schema?.$id?.split('/').pop() ?? null;
export const anchor = (name: string) => name.toLowerCase();

/** Type court, TS-like, d'un champ (pour le badge). */
export function renderType(schema: JsonSchema | undefined): string {
  if (!schema) return 'unknown';
  if (schema.enum) {
    return schema.enum.map((v) => (typeof v === 'string' ? `'${v}'` : String(v))).join(' | ');
  }
  if (schema.const !== undefined) {
    return typeof schema.const === 'string' ? `'${schema.const}'` : String(schema.const);
  }
  if (schema.anyOf) {
    const hasNull = schema.anyOf.some((v) => v.type === 'null');
    const nonNull = schema.anyOf.filter((v) => v.type !== 'null');
    const isDate = nonNull.some((v) => v.type === 'Date' || v.format === 'date-time');
    const base = isDate
      ? 'string (date)'
      : nonNull.length === 1
        ? renderType(nonNull[0])
        : nonNull.map(renderType).join(' | ');
    return hasNull ? `${base} | null` : base;
  }
  if (schema.type === 'array') return `${renderType(schema.items)}[]`;
  if (schema.type === 'object') return 'objet';
  if (schema.type === 'string' && schema.format) {
    return schema.format === 'date-time' ? 'string (date)' : `string (${schema.format})`;
  }
  const t = Array.isArray(schema.type) ? schema.type.join(' | ') : (schema.type ?? 'unknown');
  return t === 'Date' ? 'string (date)' : t;
}

/** Schéma d'objet à déplier pour un champ (objet, tableau d'objets, ou nullable). */
export function objectChild(prop: JsonSchema): JsonSchema | null {
  if (prop.type === 'object') return prop;
  if (prop.type === 'array' && prop.items?.type === 'object') return prop.items;
  if (prop.anyOf) {
    const obj = prop.anyOf.find((v) => v.type === 'object');
    if (obj) return obj;
    const arr = prop.anyOf.find((v) => v.type === 'array' && v.items?.type === 'object');
    if (arr?.items) return arr.items;
  }
  return null;
}

/** Modèle documenté correspondant à un champ objet, sinon null (→ lien plutôt que dépliage). */
export function linkedModel(prop: JsonSchema): string | null {
  const child = objectChild(prop);
  const name = child ? schemaName(child) : null;
  return name && modelSet.has(name) ? name : null;
}

// ── Exemple de valeur (réponse JSON, body) ──────────────────────────────────

export function exampleValue(schema: JsonSchema | undefined): unknown {
  if (!schema) return null;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum) return schema.enum[0];
  if (schema.const !== undefined) return schema.const;
  if (schema.anyOf) {
    const nonNull = schema.anyOf.filter((v) => v.type !== 'null');
    if (nonNull.some((v) => v.type === 'Date' || v.format === 'date-time')) {
      return '2024-01-01T12:00:00.000Z';
    }
    return exampleValue(nonNull[0]);
  }
  if (schema.type === 'array') return [exampleValue(schema.items)];
  if (schema.type === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema.properties ?? {})) out[k] = exampleValue(v);
    return out;
  }
  if (schema.type === 'number' || schema.type === 'integer') return 0;
  if (schema.type === 'boolean') return true;
  if (schema.type === 'Date') return '2024-01-01T12:00:00.000Z';
  if (schema.format === 'uuid') return '3fa85f64-5717-4562-b3fc-2c963f66afa6';
  if (schema.format === 'email') return 'client@exemple.fr';
  return 'string';
}

// ── Route → modèle (exemple d'appel), GET prioritaire ───────────────────────

const routeIndex: Map<string, Route & { op: Operation }> = (() => {
  const byModel = new Map<string, Route & { op: Operation }>();
  for (const method of METHODS) {
    for (const [path, item] of Object.entries(spec.paths)) {
      const op = item[method];
      const model = refName(op?.responses?.['200']?.content?.['application/json']?.schema?.$ref);
      if (model && !byModel.has(model)) byModel.set(model, { method, path, op });
    }
  }
  return byModel;
})();

export function routeFor(model: string): Route | null {
  const r = routeIndex.get(model);
  return r ? { method: r.method, path: r.path } : null;
}

/** Namespace de façade du modèle = celui de la route qui le renvoie (via son tag). */
export function namespaceFor(model: string): string | null {
  const tag = routeIndex.get(model)?.op.tags?.[0];
  return tag ? (TAG_NAMESPACE[tag] ?? null) : null;
}

function indent(text: string, pad: string): string {
  return text
    .split('\n')
    .map((l, i) => (i === 0 ? l : pad + l))
    .join('\n');
}

/** Exemple d'appel SDK (`@echoppe/client`) qui retourne ce modèle. */
export function codeExample(model: string): string | null {
  const route = routeIndex.get(model);
  if (!route) return null;

  const pathParams = [...route.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const queryParams = (route.op.parameters ?? []).filter((p) => p.in === 'query');
  const bodySchema = route.op.requestBody?.content?.['application/json']?.schema;

  const opts: string[] = [];
  if (pathParams.length > 0) {
    const entries = pathParams
      .map((p) => `${p}: ${p.toLowerCase().includes('slug') ? "'mon-slug'" : "'3fa85f64-…'"}`)
      .join(', ');
    opts.push(`  params: { path: { ${entries} } },`);
  }
  if (queryParams.length > 0) {
    const entries = queryParams
      .map((p) => `${p.name}: ${JSON.stringify(exampleValue(p.schema))}`)
      .join(', ');
    opts.push(`  params: { query: { ${entries} } },`);
  }
  if (bodySchema) {
    opts.push(`  body: ${indent(JSON.stringify(exampleValue(bodySchema), null, 2), '  ')},`);
  }
  const initArg = opts.length > 0 ? `{\n${opts.join('\n')}\n}` : '';

  // Appel via la façade (`echoppe.<namespace>.<méthode>(...)`) quand la route y est exposée ;
  // sinon repli sur le client brut (`echoppe.raw.<VERBE>('/chemin', ...)`).
  const ns = route.op.tags?.[0] ? TAG_NAMESPACE[route.op.tags[0]] : undefined;
  const fn = route.op.operationId ? METHOD_NAMES[route.op.operationId] : undefined;
  const call =
    ns && fn
      ? `echoppe.${ns}.${fn}(${initArg})`
      : `echoppe.raw.${route.method.toUpperCase()}('${route.path}'${initArg ? `, ${initArg}` : ''})`;

  return [
    "import { createEchoppeClient } from '@echoppe/client';",
    '',
    "const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });",
    '',
    `const { data, error } = await ${call};`,
  ].join('\n');
}

/** Équivalent REST « brut » (fetch) de l'appel qui retourne ce modèle. */
export function restExample(model: string): string | null {
  const route = routeIndex.get(model);
  if (!route) return null;

  let url = route.path;
  for (const [, name] of url.matchAll(/\{(\w+)\}/g)) {
    url = url.replace(`{${name}}`, name.toLowerCase().includes('slug') ? 'mon-slug' : '3fa85f64-…');
  }
  const queryParams = (route.op.parameters ?? []).filter((p) => p.in === 'query');
  const qs = queryParams.length
    ? `?${queryParams.map((p) => `${p.name}=${exampleValue(p.schema)}`).join('&')}`
    : '';
  const bodySchema = route.op.requestBody?.content?.['application/json']?.schema;

  const init = [`  method: '${route.method.toUpperCase()}',`, "  credentials: 'include',"];
  if (bodySchema) {
    init.push("  headers: { 'Content-Type': 'application/json' },");
    init.push(`  body: JSON.stringify(${indent(JSON.stringify(exampleValue(bodySchema), null, 2), '  ')}),`);
  }

  return [
    `const res = await fetch('https://api.maboutique.fr${url}${qs}', {`,
    init.join('\n'),
    '});',
    'const data = await res.json();',
  ].join('\n');
}

export function responseSample(schema: JsonSchema): string {
  return JSON.stringify(exampleValue(schema), null, 2);
}

/** Un exemple JSON par code de réponse de la route du modèle (200 + socle d'erreurs). */
export function responseExamples(model: string): { code: string; json: string }[] {
  const route = routeIndex.get(model);
  if (!route) {
    return [{ code: '200', json: responseSample(schemas[model]) }];
  }
  const responses = route.op.responses ?? {};
  const out: { code: string; json: string }[] = [];
  for (const code of Object.keys(responses).sort()) {
    const schema = responses[code]?.content?.['application/json']?.schema;
    if (!schema) continue;
    const ref = refName(schema.$ref);
    const resolved = ref ? schemas[ref] : schema;
    out.push({ code, json: JSON.stringify(exampleValue(resolved), null, 2) });
  }
  return out.length > 0 ? out : [{ code: '200', json: responseSample(schemas[model]) }];
}
