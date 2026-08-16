import { beforeAll, describe, expect, it } from 'bun:test';
import { db, entityDefinition, eq, permission, role, session, sql, user } from '@echoppe/core';
import { invalidatePermissionCache } from '@repo/auth';
import { createAdminSession, migrate, req, requireSmokeDb } from './harness';

// Administration des occurrences, et la ressource RBAC qui naît avec l'entité (#26).
//
// PRINCIPE : une table doit avoir son RBAC. La ressource `entity:<nom>` n'est écrite NULLE PART —
// elle est dérivée du registre à la volée (ADR-0038, amendement 2) — mais elle protège comme une
// autre, et les droits ACCORDÉS, qui sont bien des lignes, meurent avec l'entité.
//
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

let ownerCookie: string;
let redacteurCookie: string;
let redacteurRoleId: string;

type Row = Record<string, unknown>;

/** Rôle qui n'a AUCUN droit au départ : c'est ce qu'on lui accorde qui se vérifie. */
async function createRedacteurSession(): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [created] = await db
    .insert(role)
    .values({ name: `Rédacteur ${suffix}`, scope: 'admin' })
    .returning();
  redacteurRoleId = created.id;

  const [redacteur] = await db
    .insert(user)
    .values({
      email: `redacteur-${suffix}@echoppe.test`,
      passwordHash: 'x',
      firstName: 'Rédacteur',
      lastName: 'Test',
      role: created.id,
      isOwner: false,
    })
    .returning();

  const token = crypto.randomUUID().replace(/-/g, '');
  await db
    .insert(session)
    .values({ token, user: redacteur.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return `echoppe_admin_session=${token}`;
}

// L'octroi passe ici par la base, pas par `PUT /roles/:id/permissions` : on vérifie la garde, pas
// la route qui accorde. Le cache des droits doit donc être invalidé à la main — c'est ce que fait
// la vraie route, et sans ça le rôle resterait vu avec les droits qu'il avait à la première requête.
async function grantOnNote(): Promise<void> {
  await db
    .insert(permission)
    .values({
      role: redacteurRoleId,
      resource: 'entity:note',
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
    })
    .onConflictDoNothing();
  invalidatePermissionCache();
}

beforeAll(async () => {
  await migrate();
  ownerCookie = await createAdminSession();
  redacteurCookie = await createRedacteurSession();
  await db.delete(entityDefinition);

  const pushed = await req('PUT', '/content/entities', {
    cookie: ownerCookie,
    body: {
      entities: {
        note: {
          name: 'note',
          singleton: false,
          fields: [
            { name: 'titre', kind: 'text', maxLength: 200, required: true },
            { name: 'vues', kind: 'number', integer: true },
          ],
        },
      },
    },
  });
  if (pushed.status !== 200) throw new Error(`Préparation impossible : push ${pushed.status}`);
});

describe('la ressource naît avec l’entité, sans être écrite', () => {
  it("refuse d'abord tout le monde : une entité déclarée n'est accordée à personne", async () => {
    const res = await req('GET', '/content/entities/note/rows', { cookie: redacteurCookie });

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      fault: { code: 'permission_denied', action: 'read', resource: 'entity:note' },
    });
  });

  it("laisse passer dès qu'un rôle détient `entity:note`, sans qu'aucun push ne l'ait créée", async () => {
    // Le push n'écrit AUCUNE ligne `permission` : la ressource est dérivée. C'est l'octroi qui est
    // une ligne, pas la ressource.
    await grantOnNote();

    const res = await req('GET', '/content/entities/note/rows', { cookie: redacteurCookie });

    expect(res.status).toBe(200);
  });

  it('ne donne aucun droit sur une AUTRE entité', async () => {
    const res = await req('GET', '/content/entities/inexistante/rows', { cookie: redacteurCookie });

    expect(res.status).toBe(403);
  });
});

describe('écriture des occurrences', () => {
  let rowId: string;

  it('crée une occurrence conforme à la déclaration', async () => {
    const res = await req('POST', '/content/entities/note/rows', {
      cookie: redacteurCookie,
      body: { slug: 'premier', data: { titre: 'Premier', vues: 3 } },
    });

    expect(res.status).toBe(200);
    const row = (await res.json()) as Row;
    expect(row.titre).toBe('Premier');
    expect(row.slug).toBe('premier');
    rowId = String(row.id);
  });

  it('refuse une donnée qui ne respecte pas la déclaration', async () => {
    // `titre` est requis, `vues` est un entier : c'est le validateur des sections qui tranche,
    // compilé depuis la même déclaration (ADR-0026).
    const missing = await req('POST', '/content/entities/note/rows', {
      cookie: redacteurCookie,
      body: { slug: 'sans-titre', data: { vues: 1 } },
    });
    expect(missing.status).toBe(422);

    const wrongType = await req('POST', '/content/entities/note/rows', {
      cookie: redacteurCookie,
      body: { slug: 'mauvais-type', data: { titre: 'X', vues: 'beaucoup' } },
    });
    expect(wrongType.status).toBe(422);
  });

  it('refuse un slug déjà pris', async () => {
    const res = await req('POST', '/content/entities/note/rows', {
      cookie: redacteurCookie,
      body: { slug: 'premier', data: { titre: 'Doublon' } },
    });

    expect(res.status).toBe(409);
  });

  it('modifie une occurrence', async () => {
    const res = await req('PUT', `/content/entities/note/rows/${rowId}`, {
      cookie: redacteurCookie,
      body: { data: { titre: 'Premier, corrigé' } },
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as Row).titre).toBe('Premier, corrigé');
  });

  it("rend 404 sur une occurrence qui n'existe pas", async () => {
    const res = await req('PUT', `/content/entities/note/rows/${crypto.randomUUID()}`, {
      cookie: redacteurCookie,
      body: { data: { titre: 'Fantôme' } },
    });

    expect(res.status).toBe(404);
  });

  it('supprime une occurrence', async () => {
    const res = await req('DELETE', `/content/entities/note/rows/${rowId}`, {
      cookie: redacteurCookie,
    });

    expect(res.status).toBe(200);
    const remaining = await db.execute<{ total: number }>(
      sql`select count(*)::int as total from entity_note`,
    );
    expect(remaining[0].total).toBe(0);
  });
});

describe('une entité qui meurt emporte ses permissions', () => {
  it('supprime les lignes qui la nomment, pour qu’un nom réutilisé n’en hérite pas', async () => {
    const before = await db.select().from(permission).where(eq(permission.resource, 'entity:note'));
    expect(before.length).toBe(1);

    const dropped = await req('PUT', '/content/entities', {
      cookie: ownerCookie,
      body: { entities: {}, confirmDestructive: true },
    });
    expect(dropped.status).toBe(200);

    const after = await db.select().from(permission).where(eq(permission.resource, 'entity:note'));
    expect(after).toEqual([]);
  });
});
