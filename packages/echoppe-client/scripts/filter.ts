// Filtre le contrat OpenAPI complet de l'API sur la surface storefront, puis tree-shake les
// `components.schemas` : seuls les schémas atteignables (via `$ref`, transitivement) depuis
// les opérations retenues survivent. Un modèle purement admin (ex. `Variant` complet avec
// `costPrice`) disparaît donc du contrat boutique s'il n'y est référencé nulle part.
//
// Fonction PURE (spec in → spec out) pour être testable sans la stack.

import type { HttpMethod } from './storefront-surface';

type Operation = Record<string, unknown>;
type PathItem = Partial<Record<HttpMethod, Operation>> & Record<string, unknown>;

export interface OpenApiSpec {
  paths: Record<string, PathItem>;
  components?: { schemas?: Record<string, unknown>; [k: string]: unknown };
  [k: string]: unknown;
}

const REF_PREFIX = '#/components/schemas/';

/** Parcourt un noeud JSON et appelle `onRef(name)` pour chaque `$ref` de schéma trouvé. */
function collectRefs(node: unknown, onRef: (name: string) => void): void {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, onRef);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && typeof value === 'string' && value.startsWith(REF_PREFIX)) {
      onRef(value.slice(REF_PREFIX.length));
    } else {
      collectRefs(value, onRef);
    }
  }
}

export interface FilterResult {
  spec: OpenApiSpec;
  /** Entrées de surface qui n'ont matché aucune route du contrat (dérive à corriger). */
  missing: string[];
  keptPaths: number;
  keptSchemas: number;
}

export function filterStorefront(
  spec: OpenApiSpec,
  surface: ReadonlyArray<readonly [HttpMethod, string]>,
): FilterResult {
  const paths: Record<string, PathItem> = {};
  const missing: string[] = [];

  for (const [method, path] of surface) {
    const operation = spec.paths[path]?.[method];
    if (!operation) {
      missing.push(`${method.toUpperCase()} ${path}`);
      continue;
    }
    paths[path] ??= {};
    paths[path][method] = operation;
  }

  // Tree-shake transitif des schémas référencés depuis les opérations retenues.
  const allSchemas = spec.components?.schemas ?? {};
  const needed = new Set<string>();
  const visit = (name: string): void => {
    if (needed.has(name)) return;
    needed.add(name);
    collectRefs(allSchemas[name], visit);
  };
  collectRefs(paths, visit);

  const schemas: Record<string, unknown> = {};
  for (const name of [...needed].sort()) {
    if (name in allSchemas) schemas[name] = allSchemas[name];
  }

  return {
    spec: { ...spec, paths, components: { ...spec.components, schemas } },
    missing,
    keptPaths: Object.keys(paths).length,
    keptSchemas: Object.keys(schemas).length,
  };
}
