import { describe, expect, it } from 'bun:test';
import { filterStorefront, type OpenApiSpec } from './filter';
import type { HttpMethod } from './storefront-surface';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const spec: OpenApiSpec = {
  openapi: '3.1.0',
  paths: {
    '/products/': {
      // storefront
      get: {
        responses: { '200': { content: { 'application/json': { schema: ref('ProductList') } } } },
      },
      // admin (ne doit PAS être retenu)
      post: {
        responses: { '200': { content: { 'application/json': { schema: ref('Product') } } } },
      },
    },
    // admin-only (ne doit PAS être retenu)
    '/products/options': {
      get: { responses: { '200': { content: { 'application/json': { schema: ref('Option') } } } } },
    },
  },
  components: {
    schemas: {
      // ProductList → référence transitivement DefaultVariant
      ProductList: { type: 'array', items: ref('DefaultVariant') },
      DefaultVariant: { type: 'object', properties: { priceHt: { type: 'string' } } },
      // schémas admin : ne doivent PAS survivre au tree-shake
      Product: { type: 'object', properties: { costPrice: { type: 'string' } } },
      Option: { type: 'object' },
    },
  },
};

const surface: ReadonlyArray<readonly [HttpMethod, string]> = [
  ['get', '/products/'],
  ['get', '/does-not-exist'], // doit remonter en `missing`
];

describe('filterStorefront', () => {
  const { spec: out, missing } = filterStorefront(spec, surface);

  it('ne garde que les opérations de la surface', () => {
    expect(Object.keys(out.paths)).toEqual(['/products/']);
    expect(Object.keys(out.paths['/products/'])).toEqual(['get']); // pas de post admin
  });

  it('tree-shake : garde les schémas atteignables (transitif), drop les autres', () => {
    const kept = Object.keys(out.components?.schemas ?? {}).sort();
    expect(kept).toEqual(['DefaultVariant', 'ProductList']);
  });

  it('drop les schémas purement admin', () => {
    const kept = out.components?.schemas ?? {};
    expect('Product' in kept).toBe(false);
    expect('Option' in kept).toBe(false);
  });

  it('remonte les entrées de surface introuvables', () => {
    expect(missing).toEqual(['GET /does-not-exist']);
  });
});
