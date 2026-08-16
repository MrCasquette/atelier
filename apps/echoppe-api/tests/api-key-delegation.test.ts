import { beforeAll, describe, expect, it } from 'bun:test';
import { db, permission, role, session, user } from '@echoppe/core';
import { createAdminSession, migrate, req, requireSmokeDb } from './harness';

// Une clé d'API est une DÉLÉGATION D'AUTORITÉ (ADR-0038, amendement du 2026-08-10). Pendant exact
// de `permission-delegation.test.ts`, qui couvre la même règle pour les lignes de permission d'un
// rôle.
//
// Le défaut que ce filet ferme : `POST /api-keys` validait les scopes contre le VOCABULAIRE
// (« ce scope existe-t-il »), jamais contre ce que l'appelant DÉTIENT. `api_key:create` était donc
// un droit universel déguisé — qui le détenait se forgeait une clé portant n'importe quel scope,
// y compris ce qu'il ne pouvait pas faire lui-même.
//
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

let ownerCookie: string;
let boundedCookie: string;

/**
 * Rôle non-owner qui peut créer des clés, lit le catalogue, et gère ses propres commandes en
 * `selfOnly` — et rien d'autre. Chaque droit est là pour éprouver une branche de la règle.
 */
async function createBoundedSession(): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [boundedRole] = await db
    .insert(role)
    .values({ name: `Clés ${suffix}`, scope: 'admin' })
    .returning();

  await db.insert(permission).values([
    {
      role: boundedRole.id,
      resource: 'api_key',
      canCreate: true,
      canRead: true,
      canUpdate: false,
      canDelete: false,
    },
    // Lecture seule : suffit pour `read:product`, pas pour `write:product`.
    {
      role: boundedRole.id,
      resource: 'product',
      canCreate: false,
      canRead: true,
      canUpdate: false,
      canDelete: false,
    },
    // Droit complet mais BORNÉ au sujet : indélégable, une clé n'a pas de « soi ».
    {
      role: boundedRole.id,
      resource: 'order',
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
      selfOnly: true,
    },
  ]);

  const [boundedUser] = await db
    .insert(user)
    .values({
      email: `cles-${suffix}@echoppe.test`,
      passwordHash: 'x',
      firstName: 'Borné',
      lastName: 'Test',
      role: boundedRole.id,
      isOwner: false,
    })
    .returning();

  const token = crypto.randomUUID().replace(/-/g, '');
  await db
    .insert(session)
    .values({ token, user: boundedUser.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return `echoppe_admin_session=${token}`;
}

const createKey = (cookie: string, scopes: string[]) =>
  req('POST', '/api-keys', { cookie, body: { name: `test-${crypto.randomUUID()}`, scopes } });

beforeAll(async () => {
  await migrate();
  ownerCookie = await createAdminSession();
  boundedCookie = await createBoundedSession();
});

describe("scopes d'une clé — on ne délègue que ce qu'on détient", () => {
  it('laisse passer un scope que le demandeur détient', async () => {
    const res = await createKey(boundedCookie, ['read:product']);

    expect(res.status).toBe(200);
  });

  it("refuse un scope d'écriture quand le demandeur n'a que la lecture", async () => {
    const res = await createKey(boundedCookie, ['write:product']);

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      fault: {
        code: 'undelegatable_grants',
        grants: [{ grant: 'write:product', reason: 'not_held' }],
      },
    });
  });

  it('refuse une ressource que le demandeur ne détient pas du tout', async () => {
    const res = await createKey(boundedCookie, ['read:customer']);

    expect(res.status).toBe(403);
  });

  it("refuse un droit détenu en selfOnly : une clé n'a pas de sujet sur lequel le borner", async () => {
    const res = await createKey(boundedCookie, ['read:order']);

    expect(res.status).toBe(403);
  });

  it('refuse tout le lot si un seul scope est hors portée', async () => {
    const res = await createKey(boundedCookie, ['read:product', 'write:product']);

    expect(res.status).toBe(403);
  });

  it("le propriétaire de l'installation délègue ce qu'il veut", async () => {
    const res = await createKey(ownerCookie, ['write:product', 'read:customer']);

    expect(res.status).toBe(200);
  });

  it('un scope hors vocabulaire reste un 422, distinct du refus de délégation', async () => {
    const res = await createKey(ownerCookie, ['write:chaussette']);

    expect(res.status).toBe(422);
  });
});
