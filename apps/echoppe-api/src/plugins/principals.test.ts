import { describe, expect, test } from 'bun:test';
import { createPrincipalRegistry, type Principal, type PrincipalRequest } from './principals';

type Identity = { who: string | null };

const principal = (type: string, who: string | null): Principal<Identity> => ({
  type,
  permissions: new Map(),
  bypass: false,
  privileged: false,
  hasSubject: false,
  identity: { who },
});

const anonymous: PrincipalRequest = { cookie: {} };

describe('registre de principaux', () => {
  test("rend le premier résolveur qui reconnaît l'appelant, dans l'ordre d'enregistrement", async () => {
    const registry = createPrincipalRegistry<Identity>();
    registry.register({
      type: 'apikey',
      resolve: async ({ authHeader }) => (authHeader ? principal('apikey', 'machine') : null),
    });
    registry.register({
      type: 'admin',
      resolve: async ({ cookie }) => (cookie.admin ? principal('admin', 'alice') : null),
    });
    registry.registerFallback({ type: 'public', resolve: async () => principal('public', null) });

    const both: PrincipalRequest = { cookie: { admin: { value: 'x' } }, authHeader: 'Bearer y' };
    expect((await registry.resolve(both)).type).toBe('apikey');
    expect((await registry.resolve({ cookie: { admin: { value: 'x' } } })).type).toBe('admin');
  });

  test("retombe sur le résolveur de dernier recours quand personne ne reconnaît l'appelant", async () => {
    const registry = createPrincipalRegistry<Identity>();
    registry.register({ type: 'admin', resolve: async () => null });
    registry.registerFallback({ type: 'public', resolve: async () => principal('public', null) });

    const resolved = await registry.resolve(anonymous);
    expect(resolved.type).toBe('public');
    expect(resolved.identity.who).toBeNull();
  });

  test('refuse un principal enregistré deux fois', () => {
    const registry = createPrincipalRegistry<Identity>();
    registry.register({ type: 'admin', resolve: async () => null });
    expect(() => registry.register({ type: 'admin', resolve: async () => null })).toThrow(
      'Principal déjà enregistré : admin',
    );
  });

  test('échoue franchement si aucun dernier recours n’est enregistré', async () => {
    const registry = createPrincipalRegistry<Identity>();
    registry.register({ type: 'admin', resolve: async () => null });
    expect(registry.resolve(anonymous)).rejects.toThrow('dernier recours');
  });

  test('refuse un bypass venu d’un résolveur non habilité', async () => {
    const registry = createPrincipalRegistry<Identity>();
    registry.register({
      type: 'customer',
      resolve: async () => ({ ...principal('customer', 'mallory'), bypass: true }),
    });
    registry.registerFallback({ type: 'public', resolve: async () => principal('public', null) });

    expect(registry.resolve(anonymous)).rejects.toThrow('Le principal « customer »');
  });

  test('laisse passer le bypass du résolveur habilité', async () => {
    const registry = createPrincipalRegistry<Identity>();
    registry.register({
      type: 'admin',
      mayBypass: true,
      resolve: async () => ({ ...principal('admin', 'alice'), bypass: true }),
    });
    registry.registerFallback({ type: 'public', resolve: async () => principal('public', null) });

    expect((await registry.resolve(anonymous)).bypass).toBe(true);
  });

  test('refuse un bypass venu du dernier recours', async () => {
    const registry = createPrincipalRegistry<Identity>();
    registry.registerFallback({
      type: 'public',
      resolve: async () => ({ ...principal('public', null), bypass: true }),
    });

    expect(registry.resolve(anonymous)).rejects.toThrow(
      'dernier recours ne peut pas court-circuiter',
    );
  });

  test("expose les types enregistrés dans l'ordre d'essai", () => {
    const registry = createPrincipalRegistry<Identity>();
    registry.register({ type: 'apikey', resolve: async () => null });
    registry.register({ type: 'admin', resolve: async () => null });
    registry.registerFallback({ type: 'public', resolve: async () => principal('public', null) });

    expect(registry.types()).toEqual(['apikey', 'admin', 'public']);
  });
});
