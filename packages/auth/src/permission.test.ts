import { describe, expect, test } from 'bun:test';
import { undelegatableGrants, undelegatableScopes } from './permission';
import type { PermissionSet, Principal } from './principal';

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

const holder = (permissions: Record<string, PermissionSet>, bypass = false): Principal<null> => ({
  type: 'admin',
  permissions: new Map(Object.entries(permissions)),
  bypass,
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
