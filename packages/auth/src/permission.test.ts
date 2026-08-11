import { describe, expect, test } from 'bun:test';
import { holds, isSelfOnly, undelegatableGrants, undelegatableScopes } from './permission';
import { granted, type PermissionSet, type Principal } from './principal';

// Une clé d'API est une délégation d'autorité (ADR-0038, amendement du 2026-08-10). La validation
// existante ne vérifiait que le VOCABULAIRE — « ce scope existe-t-il » —, jamais « le détiens-tu ».

const perm = (over: Partial<PermissionSet> = {}): PermissionSet => ({
  canCreate: false,
  canRead: false,
  canUpdate: false,
  canDelete: false,
  selfOnly: false,
  ...over,
});

const holder = (permissions: Record<string, PermissionSet>, total = false): Principal<null> => ({
  type: 'admin',
  authority: total ? { kind: 'total' } : granted(new Map(Object.entries(permissions))),
  privileged: true,
  hasSubject: true,
  identity: null,
});

const grant = (resource: string, over: Partial<PermissionSet> = {}) => ({
  resource,
  canCreate: false,
  canRead: false,
  canUpdate: false,
  canDelete: false,
  ...over,
});

// Le prédicat d'autorité (ADR-0047). L'autorité `except` n'a pas encore de producteur — c'est #49
// qui l'attribuera à l'Administrateur — mais son contrat est décidé, et le tester ICI est ce qui
// rend cette attribution sûre.
describe('holds — les trois autorités', () => {
  const anything = { kind: 'total' } as const;

  const except = (over: Partial<{ reserved: string[]; readOnly: string[]; ownRows: string[] }>) =>
    ({
      kind: 'except',
      reserved: new Set(over.reserved ?? []),
      readOnly: new Set(over.readOnly ?? []),
      ownRowsOnly: new Set(over.ownRows ?? []),
    }) as const;

  test('`total` détient tout, y compris ce qui n’a jamais été nommé', () => {
    expect(holds(anything, 'entity:jamais_vue', 'delete')).toBe(true);
    expect(isSelfOnly(anything, 'api_key')).toBe(false);
  });

  test('`granted` ne détient que ce qu’une ligne accorde, action par action', () => {
    const authority = granted(new Map([['product', perm({ canRead: true })]]));

    expect(holds(authority, 'product', 'read')).toBe(true);
    expect(holds(authority, 'product', 'update')).toBe(false);
    expect(holds(authority, 'order', 'read')).toBe(false);
  });

  test('`except` détient tout ce qui n’est pas nommé — les ressources futures comprises', () => {
    // C'est l'écart qui a produit ADR-0047 : une liste ne peut pas contenir ce qui n'existait pas
    // quand on l'a écrite.
    expect(
      holds(except({ reserved: ['payment_config'] }), 'entity:declaree_demain', 'create'),
    ).toBe(true);
  });

  test('`except` ne détient rien de ce qui est réservé', () => {
    const authority = except({ reserved: ['payment_config'] });

    expect(holds(authority, 'payment_config', 'read')).toBe(false);
    expect(holds(authority, 'payment_config', 'update')).toBe(false);
  });

  test('`except` lit ce qui est en lecture seule, et ne l’écrit jamais', () => {
    const authority = except({ readOnly: ['audit_log'] });

    expect(holds(authority, 'audit_log', 'read')).toBe(true);
    expect(holds(authority, 'audit_log', 'update')).toBe(false);
    expect(holds(authority, 'audit_log', 'delete')).toBe(false);
  });

  test('`except` reste borné à ses propres lignes là où c’est déclaré', () => {
    const authority = except({ ownRows: ['api_key'] });

    expect(holds(authority, 'api_key', 'delete')).toBe(true);
    expect(isSelfOnly(authority, 'api_key')).toBe(true);
    expect(isSelfOnly(authority, 'product')).toBe(false);
  });
});

// `schema` — le droit de redéfinir la forme des données — tient au RANG et non à la possession
// (ADR-0038, amendement du 2026-08-10). Le détenir ne donne pas le droit de le transmettre.
describe('ressources de rang', () => {
  test("un administrateur qui détient `schema` ne peut pas l'accorder", () => {
    const admin = holder({
      schema: perm({ canCreate: true, canRead: true, canUpdate: true, canDelete: true }),
    });

    const refused = undelegatableGrants(admin, [grant('schema', { canUpdate: true })]);

    expect(refused).toHaveLength(1);
    expect(refused[0]).toContain('schema');
  });

  test('une ligne `schema` qui n’accorde rien passe — elle ne transmet rien', () => {
    const admin = holder({ schema: perm({ canUpdate: true }) });

    expect(undelegatableGrants(admin, [grant('schema')])).toEqual([]);
  });

  test('les autres ressources restent gouvernées par la seule possession', () => {
    const admin = holder({ product: perm({ canUpdate: true }) });

    expect(undelegatableGrants(admin, [grant('product', { canUpdate: true })])).toEqual([]);
  });

  test("le propriétaire de l'installation court-circuite : il peut déjà nommer un administrateur", () => {
    const owner = holder({}, true);

    expect(undelegatableGrants(owner, [grant('schema', { canUpdate: true })])).toEqual([]);
  });
});

describe('délégation des scopes de clé', () => {
  test("laisse passer ce que l'émetteur détient", () => {
    const principal = holder({
      product: perm({ canRead: true }),
      media: perm({ canCreate: true, canUpdate: true, canDelete: true }),
    });

    expect(undelegatableScopes(principal, ['read:product', 'write:media'])).toEqual([]);
  });

  test('refuse un scope sur une ressource que le principal ne détient pas du tout', () => {
    const principal = holder({ product: perm({ canRead: true }) });

    expect(undelegatableScopes(principal, ['read:customer'])).toEqual(['read:customer']);
  });

  test('`write` est composite : lire ne suffit pas à déléguer l’écriture', () => {
    const principal = holder({ product: perm({ canRead: true, canUpdate: true }) });

    // canCreate et canDelete manquent → la clé aurait plus de pouvoir que son émetteur.
    expect(undelegatableScopes(principal, ['write:product'])).toEqual(['write:product']);
  });

  test("refuse un droit détenu en `selfOnly` : une clé n'a pas de sujet sur lequel borner", () => {
    const principal = holder({
      order: perm({
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        selfOnly: true,
      }),
    });

    expect(undelegatableScopes(principal, ['read:order'])).toEqual(['read:order']);
    expect(undelegatableScopes(principal, ['write:order'])).toEqual(['write:order']);
  });

  test("le propriétaire de l'installation court-circuite, comme partout", () => {
    const owner = holder({}, true);

    expect(undelegatableScopes(owner, ['write:product', 'read:customer'])).toEqual([]);
  });

  test('découpe sur le premier `:` seulement — une ressource peut en contenir', () => {
    const principal = holder({
      'entity:article': perm({ canCreate: true, canUpdate: true, canDelete: true }),
    });

    expect(undelegatableScopes(principal, ['write:entity:article'])).toEqual([]);
    expect(undelegatableScopes(principal, ['read:entity:article'])).toEqual([
      'read:entity:article',
    ]);
  });

  test('rend TOUS les scopes refusés, pas seulement le premier', () => {
    const principal = holder({ product: perm({ canRead: true }) });

    expect(undelegatableScopes(principal, ['read:product', 'write:product', 'read:user'])).toEqual([
      'write:product',
      'read:user',
    ]);
  });
});
