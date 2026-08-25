import { beforeAll, describe, expect, it } from 'bun:test';
import { role, session, user } from '@repo/auth';
import { db, eq } from '@repo/db';
import { invalidatePermissionCache, invalidateSystemRoleCache } from '@repo/auth';
import {
  createAdminSession,
  migrate,
  record,
  req,
  requireDisposableDb,
} from './harness';

// Le transfert de propriété (ADR-0047, décision 6).
//
// Ce qui se vérifie ici n'est pas qu'un drapeau bouge, mais que le transfert est **sans retour pour
// celui qui le fait** : l'ancien propriétaire ne peut pas reprendre, seul le nouveau peut lui
// rendre. Un transfert annulable unilatéralement serait un prêt, et le sortant garderait l'autorité
// qu'il est censé avoir cédée.
//
// ⚠️ Base JETABLE via `bun run integration echoppe api` uniquement.
requireDisposableDb();

let ownerCookie: string;
let ownerId: string;
let heirCookie: string;
let heirId: string;
let inactiveId: string;

/** Une session pour un utilisateur donné, sans passer par `/auth/login`. */
async function sessionFor(userId: string): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, '');
  await db
    .insert(session)
    .values({ token, user: userId, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return `echoppe_admin_session=${token}`;
}

async function createUser(isActive: boolean, roleId: string): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [created] = await db
    .insert(user)
    .values({
      email: `transfert-${suffix}@echoppe.test`,
      passwordHash: 'x',
      firstName: 'Héritier',
      lastName: suffix,
      role: roleId,
      isOwner: false,
      isActive,
    })
    .returning();
  return created.id;
}

beforeAll(async () => {
  await migrate();
  ownerCookie = await createAdminSession();
  invalidateSystemRoleCache();
  invalidatePermissionCache();

  const [owner] = await db.select().from(user).where(eq(user.isOwner, true));
  ownerId = owner.id;

  const [ordinaryRole] = await db
    .insert(role)
    .values({ name: `Transfert ${crypto.randomUUID().slice(0, 8)}`, scope: 'admin' })
    .returning();

  heirId = await createUser(true, ordinaryRole.id);
  heirCookie = await sessionFor(heirId);
  inactiveId = await createUser(false, ordinaryRole.id);
});

const transfer = (to: string, cookie: string) =>
  req('POST', `/users/${to}/ownership`, { cookie, body: {} });

describe('ce que le transfert refuse', () => {
  it("refuse à qui n'est pas le propriétaire — la propriété ne se prend pas, elle se donne", async () => {
    const res = await transfer(ownerId, heirCookie);

    expect(res.status).toBe(403);
  });

  it('refuse une cible désactivée : elle ne pourrait pas se connecter', async () => {
    // Et le transfert est sans retour, donc l'installation serait perdue définitivement.
    const res = await transfer(inactiveId, ownerCookie);

    expect(res.status).toBe(400);
    expect(record(await res.json())).toMatchObject({
      fault: { code: 'invalid_state', resource: 'user', current: 'disabled', expected: 'active' },
    });
  });

  it('refuse une cible qui est déjà le propriétaire', async () => {
    expect((await transfer(ownerId, ownerCookie)).status).toBe(400);
  });

  it('refuse une cible inexistante', async () => {
    expect((await transfer(crypto.randomUUID(), ownerCookie)).status).toBe(404);
  });
});

describe('le transfert, et son irréversibilité', () => {
  it('déplace la propriété, sans jamais en laisser deux ni zéro', async () => {
    expect((await transfer(heirId, ownerCookie)).status).toBe(200);

    const owners = await db.select({ id: user.id }).from(user).where(eq(user.isOwner, true));
    expect(owners).toEqual([{ id: heirId }]);
  });

  it("retire son autorité à l'ancien propriétaire, dans la foulée", async () => {
    // Rien n'a été invalidé : l'autorité se recalcule à chaque requête depuis la session.
    const res = await req('GET', '/payments/providers', { cookie: ownerCookie });

    expect(res.status).toBe(403);
  });

  it('interdit à l’ancien propriétaire de la reprendre — seul le nouveau peut la rendre', async () => {
    const res = await transfer(ownerId, ownerCookie);

    expect(res.status).toBe(403);
  });

  it('laisse le nouveau propriétaire la rendre', async () => {
    expect((await transfer(ownerId, heirCookie)).status).toBe(200);

    // La base repart comme elle est arrivée : les autres fichiers du run partagent ce propriétaire.
    const owners = await db.select({ id: user.id }).from(user).where(eq(user.isOwner, true));
    expect(owners).toEqual([{ id: ownerId }]);
  });
});
