import { beforeAll, describe, expect, it } from 'bun:test';
import { db, eq, permission, role, session, user } from '@echoppe/core';
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
let adminCookie: string;
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

/**
 * Session sur le rôle système `admin` — le premier rang sans être propriétaire. Il détient
 * `permission:update` mais PAS `media` : c'est ce qui permet de vérifier que le rang autorise la
 * révocation indépendamment de la portée.
 */
async function createAdminRankSession(): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  // `key` est unique : la base vierge n'a pas de rôle système, on le crée une fois.
  await db
    .insert(role)
    .values({ key: 'admin', name: 'Administrateur', scope: 'admin', isSystem: true })
    .onConflictDoNothing();
  const [adminRole] = await db.select().from(role).where(eq(role.key, 'admin'));

  await db
    .insert(permission)
    .values({
      role: adminRole.id,
      resource: 'permission',
      canCreate: false,
      canRead: true,
      canUpdate: true,
      canDelete: false,
    })
    .onConflictDoNothing();

  const [adminUser] = await db
    .insert(user)
    .values({
      email: `rang-admin-${suffix}@echoppe.test`,
      passwordHash: 'x',
      firstName: 'Rang',
      lastName: 'Admin',
      role: adminRole.id,
      isOwner: false,
    })
    .returning();

  const token = crypto.randomUUID().replace(/-/g, '');
  await db
    .insert(session)
    .values({ token, user: adminUser.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return `echoppe_admin_session=${token}`;
}

beforeAll(async () => {
  await migrate();
  ownerCookie = await createAdminSession();
  boundedCookie = await createBoundedSession();
  adminCookie = await createAdminRankSession();

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

  it('refuse toute révocation hors du premier rang', async () => {
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
    expect(body.message).toContain('premier rang');
    expect(body.message).toContain('media:read');
    expect(body.message).toContain('media:delete');
  });

  it("refuse la révocation même sur une ressource qu'on détient", async () => {
    // Le rôle borné détient `product:read`. La possession ne change rien : seul le rang autorise.
    const seeded = await req('PUT', `/roles/${targetRoleId}/permissions`, {
      cookie: ownerCookie,
      body: { permissions: [grant('product', { canRead: true })] },
    });
    expect(seeded.status).toBe(200);

    const res = await req('PUT', `/roles/${targetRoleId}/permissions`, {
      cookie: boundedCookie,
      body: { permissions: [] },
    });

    expect(res.status).toBe(403);
    expect((await res.json()) as { message: string }).toMatchObject({
      message: expect.stringContaining('product:read'),
    });
  });

  it("un administrateur révoque, y compris ce qu'il ne détient pas", async () => {
    const seeded = await req('PUT', `/roles/${targetRoleId}/permissions`, {
      cookie: ownerCookie,
      body: { permissions: [grant('media', { canRead: true })] },
    });
    expect(seeded.status).toBe(200);

    const res = await req('PUT', `/roles/${targetRoleId}/permissions`, {
      cookie: adminCookie,
      body: { permissions: [] },
    });

    expect(res.status).toBe(200);
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
