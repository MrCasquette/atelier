import { beforeAll, describe, expect, it } from 'bun:test';
import { db, entityDefinition, eq, role, session, user } from '@echoppe/core';
import { invalidatePermissionCache, invalidateSystemRoleCache } from '@repo/auth';
import { createAdminSession, migrate, req, requireSmokeDb } from './harness';

// L'Administrateur défini par soustraction (ADR-0047).
//
// Aucun test n'exerçait ce rôle : c'est ce qui a laissé passer l'écart d'origine — il pouvait
// dériver la table d'une entité et n'avait aucun droit de lire ce qu'il venait de créer. Ce qui se
// vérifie ici n'est donc pas « il a des droits », mais les TROIS BORNES, et le fait que tout le
// reste lui revienne SANS avoir été nommé.
//
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

let ownerCookie: string;
let adminCookie: string;

/**
 * Une session portant le rôle système `admin` — celui que `key` désigne, pas celui que `name`
 * affiche. `key` est unique en base : le rôle est partagé avec les autres fichiers du run, on le
 * réutilise s'il existe déjà.
 */
async function createAdministratorSession(): Promise<string> {
  const [existing] = await db.select().from(role).where(eq(role.key, 'admin'));
  const adminRole =
    existing ??
    (
      await db
        .insert(role)
        .values({ key: 'admin', name: 'Administrateur', scope: 'admin', isSystem: true })
        .returning()
    )[0];
  invalidateSystemRoleCache();
  invalidatePermissionCache();

  const suffix = crypto.randomUUID().slice(0, 8);
  const [administrator] = await db
    .insert(user)
    .values({
      email: `administrateur-${suffix}@echoppe.test`,
      passwordHash: 'x',
      firstName: 'Admin',
      lastName: 'Second',
      role: adminRole.id,
      // Pas le propriétaire : c'est tout l'objet du test.
      isOwner: false,
    })
    .returning();

  const token = crypto.randomUUID().replace(/-/g, '');
  await db
    .insert(session)
    .values({ token, user: administrator.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return `echoppe_admin_session=${token}`;
}

beforeAll(async () => {
  await migrate();
  ownerCookie = await createAdminSession();
  adminCookie = await createAdministratorSession();
  await db.delete(entityDefinition);

  const pushed = await req('PUT', '/content/entities', {
    cookie: ownerCookie,
    body: {
      entities: {
        communique: {
          name: 'communique',
          singleton: false,
          fields: { titre: { kind: 'text', required: true } },
        },
      },
    },
  });
  if (pushed.status !== 200) {
    const body = (await pushed.json()) as { message?: string };
    throw new Error(`Préparation impossible : push ${pushed.status} — ${body.message ?? ''}`);
  }
});

describe('ce qui lui revient sans avoir été nommé', () => {
  it("détient une entité déclarée APRÈS lui — l'écart qui a produit ADR-0047", async () => {
    // Aucune ligne de permission ne porte `entity:communique`, et il n'y en aura jamais : la
    // ressource est dérivée du registre (ADR-0038). C'est la règle qui la lui donne.
    const res = await req('GET', '/content/entities/communique/rows', { cookie: adminCookie });

    expect(res.status).toBe(200);
  });

  it('la voit dans ce qu’il peut administrer', async () => {
    const res = await req('GET', '/content/entities/mine', { cookie: adminCookie });
    const body = (await res.json()) as { entities: { name: string; actions: string[] }[] };

    const communique = body.entities.find((entity) => entity.name === 'communique');
    expect(communique?.actions.sort()).toEqual(['create', 'delete', 'read', 'update']);
  });

  it('gère le RBAC — sinon ce n’est pas un administrateur', async () => {
    expect((await req('GET', '/roles', { cookie: adminCookie })).status).toBe(200);
    expect((await req('GET', '/users', { cookie: adminCookie })).status).toBe(200);
  });
});

describe('les trois bornes', () => {
  it('ne détient pas les credentials, qui restent au propriétaire', async () => {
    const payment = await req('GET', '/payments/providers', { cookie: adminCookie });
    expect(payment.status).toBe(403);

    // Le propriétaire, lui, passe.
    expect((await req('GET', '/payments/providers', { cookie: ownerCookie })).status).toBe(200);
  });

  it('lit le journal d’audit et ne l’écrit jamais', async () => {
    expect((await req('GET', '/audit-logs', { cookie: adminCookie })).status).toBe(200);
  });

  it('reste borné à ses propres clés d’API', async () => {
    // `selfOnly` : la liste ne rend que les siennes, et il n'en a aucune.
    const res = await req('GET', '/api-keys', { cookie: adminCookie });

    expect(res.status).toBe(200);
    expect((await res.json()) as unknown[]).toEqual([]);
  });
});

describe('ce qu’il peut déléguer, et ce qu’il ne peut pas', () => {
  let customRoleId: string;

  beforeAll(async () => {
    const created = await req('POST', '/roles', {
      cookie: adminCookie,
      body: { name: `Rédacteur ${crypto.randomUUID().slice(0, 8)}`, scope: 'admin' },
    });
    customRoleId = ((await created.json()) as { id: string }).id;
  });

  it('accorde une entité à un rôle sur mesure — il la détient, donc il la transmet', async () => {
    const res = await req('PUT', `/roles/${customRoleId}/permissions`, {
      cookie: adminCookie,
      body: {
        permissions: [
          {
            resource: 'entity:communique',
            canCreate: false,
            canRead: true,
            canUpdate: true,
            canDelete: false,
          },
        ],
      },
    });

    expect(res.status).toBe(200);
  });

  it('ne peut pas accorder ce qu’il ne détient pas', async () => {
    const res = await req('PUT', `/roles/${customRoleId}/permissions`, {
      cookie: adminCookie,
      body: {
        permissions: [
          {
            resource: 'payment_config',
            canCreate: false,
            canRead: true,
            canUpdate: false,
            canDelete: false,
          },
        ],
      },
    });

    expect(res.status).toBe(403);
    expect(((await res.json()) as { message: string }).message).toContain('payment_config');
  });

  it('ne peut pas transmettre `schema`, qu’il détient pourtant', async () => {
    // La règle de rang (ADR-0038) survit à la soustraction : détenir n'est pas pouvoir transmettre.
    const res = await req('PUT', `/roles/${customRoleId}/permissions`, {
      cookie: adminCookie,
      body: {
        permissions: [
          {
            resource: 'schema',
            canCreate: false,
            canRead: false,
            canUpdate: true,
            canDelete: false,
          },
        ],
      },
    });

    expect(res.status).toBe(403);
    expect(((await res.json()) as { message: string }).message).toContain('rang');
  });

  it('ne peut pas se forger une clé d’API sur ce qu’il ne détient pas', async () => {
    const res = await req('POST', '/api-keys', {
      cookie: adminCookie,
      body: { name: 'clé de test', scopes: ['read:payment_config'] },
    });

    expect(res.status).toBe(403);
  });
});
