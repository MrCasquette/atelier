import { describe, expect, it } from 'bun:test';
import { createAdapterRegistry } from './registry';

// Verrou audit2 #7 : le registre déclaratif mémoïse les instances, dérive `available` de la liste
// déclarée (ordre préservé), et `reset` purge le cache.
const PROVIDERS = ['a', 'b', 'c'] as const;
type P = (typeof PROVIDERS)[number];

describe('createAdapterRegistry', () => {
  it('mémoïse : get renvoie la même instance', () => {
    let built = 0;
    const registry = createAdapterRegistry<P, { id: number }>(PROVIDERS, {
      a: () => ({ id: ++built }),
      b: () => ({ id: ++built }),
      c: () => ({ id: ++built }),
    });
    const first = registry.get('a');
    expect(registry.get('a')).toBe(first);
    expect(built).toBe(1);
  });

  it('available filtre selon le prédicat, dans l’ordre déclaré', async () => {
    const registry = createAdapterRegistry<P, object>(PROVIDERS, {
      a: () => ({}),
      b: () => ({}),
      c: () => ({}),
    });
    const ready = await registry.available((p) => Promise.resolve(p !== 'b'));
    expect(ready).toEqual(['a', 'c']);
  });

  it('reset purge les instances mémoïsées', () => {
    let built = 0;
    const registry = createAdapterRegistry<P, { id: number }>(PROVIDERS, {
      a: () => ({ id: ++built }),
      b: () => ({ id: ++built }),
      c: () => ({ id: ++built }),
    });
    registry.get('a');
    registry.reset();
    registry.get('a');
    expect(built).toBe(2);
  });
});
