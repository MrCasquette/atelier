import { beforeAll, describe, expect, it } from 'bun:test';
import { db, permission, role, session, user } from '@echoppe/core';
import { createAdminSession, migrate, req, requireSmokeDb } from './harness';

// Délégation (ADR-0038) : on ne peut accorder que ce qu'on détient.
//
// Avant cette règle, `permission:update` suffisait à tout accorder : un administrateur borné au
// catalogue pouvait s'attribuer les droits sur `user` ou `api_key` via son propre rôle. Le drapeau
// `locked` ne protège que les lignes qu'on a pensé à verrouiller, pas le principe.
//
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

let ownerCookie: string;
let boundedCookie: string;
let targetRoleId: string;

/** Rôle non-owner détenant `permission:update` et le catalogue en lecture — et rien d'autre. */
async function createBoundedSession(): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [boundedRole] = await db
    .insert(role)
    .values({ name: `Catalogue ${suffix}`, scope: 'admin' })
    .returning();

  await db.insert(permission).values([
    {
      role: boundedRole.id,
      resource: 'permission',
      canCreate: false,
      canRead: true,
      canUpdate: true,
      canDelete: false,
    },
    {
      role: boundedRole.id,
      resource: 'product',
      canCreate: false,
      canRead: true,
      canUpdate: false,
      canDelete: false,
    },
  ]);

  const [boundedUser] = await db
    .insert(user)
    .values({
      email: `borne-${suffix}@echoppe.test`,
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

beforeAll(async () => {
  await migrate();
  ownerCookie = await createAdminSession();
  boundedCookie = await createBoundedSession();

  const [target] = await db
    .insert(role)
    .values({ name: `Cible ${crypto.randomUUID().slice(0, 8)}`, scope: 'admin' })
    .returning();
  targetRoleId = target.id;
});

const grant = (resource: string, actions: Partial<Record<string, boolean>> = {}) => ({
  resource,
  canCreate: actions.canCreate ?? false,
  canRead: actions.canRead ?? false,
  canUpdate: actions.canUpdate ?? false,
  canDelete: actions.canDelete ?? false,
});

describe('délégation des droits', () => {
  it("refuse d'accorder un droit qu'on ne détient pas", async () => {
    const res = await req('PUT', `/roles/${targetRoleId}/permissions`, {
      cookie: boundedCookie,
      body: { permissions: [grant('user', { canRead: true, canDelete: true })] },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { message: string };
    // Le message nomme CE QUI est refusé, action par action.
    expect(body.message).toContain('user:read');
    expect(body.message).toContain('user:delete');
  });

  it("refuse l'action non détenue même sur une ressource qu'on détient", async () => {
    // Le rôle borné a `product:read`, pas `product:delete`.
    const res = await req('PUT', `/roles/${targetRoleId}/permissions`, {
      cookie: boundedCookie,
      body: { permissions: [grant('product', { canRead: true, canDelete: true })] },
    });

    expect(res.status).toBe(403);
    expect((await res.json()) as { message: string }).toMatchObject({
      message: expect.stringContaining('product:delete'),
    });
  });

  it('accepte ce qui est réellement détenu', async () => {
    const res = await req('PUT', `/roles/${targetRoleId}/permissions`, {
      cookie: boundedCookie,
      body: { permissions: [grant('product', { canRead: true })] },
    });

    expect(res.status).toBe(200);
  });

  it("refuse de retirer un droit qu'on ne détient pas", async () => {
    // L'owner installe sur le rôle cible un droit hors de la portée du rôle borné.
    const seeded = await req('PUT', `/roles/${targetRoleId}/permissions`, {
      cookie: ownerCookie,
      body: { permissions: [grant('media', { canRead: true, canDelete: true })] },
    });
    expect(seeded.status).toBe(200);

    // La route remplace l'ensemble : soumettre une liste vide, c'est demander la suppression.
    const res = await req('PUT', `/roles/${targetRoleId}/permissions`, {
      cookie: boundedCookie,
      body: { permissions: [] },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain('non révocables');
    expect(body.message).toContain('media:read');
    expect(body.message).toContain('media:delete');
  });

  it("l'owner court-circuite la délégation", async () => {
    const res = await req('PUT', `/roles/${targetRoleId}/permissions`, {
      cookie: ownerCookie,
      body: {
        permissions: [grant('user', { canRead: true, canUpdate: true, canDelete: true })],
      },
    });

    expect(res.status).toBe(200);
  });
});
