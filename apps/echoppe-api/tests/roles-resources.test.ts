import { beforeAll, describe, expect, it } from 'bun:test';
import { db, entityDefinition, eq, permission, role, session, user } from '@echoppe/core';
import { invalidatePermissionCache, invalidateSystemRoleCache } from '@repo/auth';
import { createAdminSession, migrate, req, requireSmokeDb } from './harness';

// `GET /roles/resources` est la SEULE liste de ce qui est protégeable (#38).
//
// L'écran des rôles tenait la sienne, à la main : `content`, `api_key` et `schema` existaient dans
// RESOURCES sans jamais y apparaître, donc sans jamais pouvoir être accordés depuis l'interface. Le
// correctif ne vaut que si cette route dit vraiment TOUT — vocabulaire du socle ET entités
// déclarées, que rien de compilé ne peut connaître à l'avance (ADR-0038).
//
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

let ownerCookie: string;
let limitedCookie: string;

type Resource = { name: string; label: string | null; actions: string[] };

async function resources(cookie: string = ownerCookie): Promise<Resource[]> {
  const res = await req('GET', '/roles/resources', { cookie });
  expect(res.status).toBe(200);
  return ((await res.json()) as { resources: Resource[] }).resources;
}

const named = (list: Resource[], name: string): Resource | undefined =>
  list.find((resource) => resource.name === name);

/**
 * Un rôle sur mesure, avec des droits ÉTROITS, et une session dessus. Il faut `role:read` pour
 * atteindre la route, et rien d'autre — c'est justement le principal que la borne concerne.
 */
async function limitedSession(): Promise<string> {
  const [custom] = await db
    .insert(role)
    .values({ name: `Borne ${crypto.randomUUID().slice(0, 8)}`, scope: 'admin' })
    .returning();

  await db.insert(permission).values([
    { role: custom.id, resource: 'role', canRead: true },
    // Pour atteindre `PUT /roles/:id/permissions` — le test d'accord entre les deux règles en a
    // besoin, et c'est bien ce principal-là que la borne vise : celui qui administre des droits
    // sans les détenir tous.
    { role: custom.id, resource: 'permission', canUpdate: true },
    // Produit : tout sauf la suppression. `product:delete` ne doit pas être proposé.
    { role: custom.id, resource: 'product', canCreate: true, canRead: true, canUpdate: true },
    // Détenu, mais réputé non délégable : il tient au rang (RANK_BOUND_RESOURCES).
    { role: custom.id, resource: 'schema', canRead: true, canUpdate: true },
  ]);

  const [limited] = await db
    .insert(user)
    .values({
      email: `borne-${crypto.randomUUID().slice(0, 8)}@echoppe.test`,
      passwordHash: 'x',
      firstName: 'Borne',
      lastName: 'Étroite',
      role: custom.id,
      isOwner: false,
    })
    .returning();

  const token = crypto.randomUUID().replace(/-/g, '');
  await db
    .insert(session)
    .values({ token, user: limited.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });

  return `echoppe_admin_session=${token}`;
}

beforeAll(async () => {
  await migrate();
  ownerCookie = await createAdminSession();
  // Journal vidé d'abord : le push remplace tout, et les tables laissées par les autres fichiers ne
  // le concernent plus une fois qu'il ne les connaît plus (même idiome qu'entity-push).
  await db.delete(entityDefinition);

  const pushed = await req('PUT', '/content/entities', {
    cookie: ownerCookie,
    body: {
      entities: {
        fiche: {
          name: 'fiche',
          label: 'Fiche pratique',
          singleton: false,
          fields: { titre: { kind: 'text', maxLength: 200, required: true } },
        },
      },
    },
  });
  if (pushed.status !== 200) throw new Error(`Préparation impossible : push ${pushed.status}`);

  limitedCookie = await limitedSession();
  invalidateSystemRoleCache();
  invalidatePermissionCache();
});

describe('les ressources protégeables viennent du serveur', () => {
  it('rend le vocabulaire du socle, y compris ce que la matrice oubliait', async () => {
    const names = (await resources()).map((resource) => resource.name);

    expect(names).toContain('product');
    // Les trois oubliées de l'écran des rôles. C'est le verrou de régression du défaut.
    expect(names).toContain('content');
    expect(names).toContain('api_key');
    expect(names).toContain('schema');
  });

  it('ajoute les entités déclarées, avec le libellé que le dev leur a donné', async () => {
    const fiche = named(await resources(), 'entity:fiche');

    expect(fiche?.label).toBe('Fiche pratique');
  });

  it("ne prête aucun libellé au vocabulaire du socle : c'est l'interface qui le traduit", async () => {
    const product = named(await resources(), 'product');

    expect(product?.label).toBeNull();
  });

  it("oublie une entité qui n'est plus déclarée", async () => {
    const dropped = await req('PUT', '/content/entities', {
      cookie: ownerCookie,
      body: { entities: {}, confirmDestructive: true },
    });
    expect(dropped.status).toBe(200);

    const names = (await resources()).map((resource) => resource.name);
    expect(names).not.toContain('entity:fiche');
    expect(names).toContain('product');
  });
});

// #45 — la borne. « On ne peut accorder que ce qu'on détient » (ADR-0038) s'appliquait au moment
// d'accorder ; la liste, elle, proposait tout. La matrice offrait donc des cases que
// l'enregistrement refusait ensuite, sans qu'on comprenne pourquoi avant d'avoir cliqué.
describe('la liste est bornée à ce que le demandeur peut accorder', () => {
  it('rend au propriétaire les quatre actions, sur tout', async () => {
    const product = named(await resources(), 'product');

    expect(product?.actions.toSorted()).toEqual(['create', 'delete', 'read', 'update']);
  });

  it("ne propose d'une ressource que les actions détenues", async () => {
    const product = named(await resources(limitedCookie), 'product');

    // `product:delete` n'est pas détenu : il ne doit pas être proposé.
    expect(product?.actions.toSorted()).toEqual(['create', 'read', 'update']);
  });

  it("tait une ressource dont on ne détient rien, plutôt que d'en offrir les cases", async () => {
    const names = (await resources(limitedCookie)).map((resource) => resource.name);

    expect(names).not.toContain('media');
    expect(names).not.toContain('payment_config');
  });

  it('tait `schema` même à qui le détient : il tient au rang, il ne se délègue pas', async () => {
    const visible = await resources(limitedCookie);
    const owned = await resources();

    expect(visible.map((resource) => resource.name)).not.toContain('schema');
    // Le propriétaire, lui, peut le donner : le don venu du sommet n'est pas une élévation.
    expect(owned.map((resource) => resource.name)).toContain('schema');
  });

  it('laisse de quoi travailler : une matrice vide serait pire que le mal', async () => {
    const visible = await resources(limitedCookie);

    expect(visible.length).toBeGreaterThan(0);
    expect(visible.map((resource) => resource.name)).toContain('role');
  });

  it("ne propose que ce que l'enregistrement accepte — les deux règles restent d'accord", async () => {
    const [custom] = await db
      .insert(role)
      .values({ name: `Cible ${crypto.randomUUID().slice(0, 8)}`, scope: 'admin' })
      .returning();

    const offered = await resources(limitedCookie);
    const submitted = offered.map((resource) => ({
      resource: resource.name,
      canCreate: resource.actions.includes('create'),
      canRead: resource.actions.includes('read'),
      canUpdate: resource.actions.includes('update'),
      canDelete: resource.actions.includes('delete'),
    }));

    const res = await req('PUT', `/roles/${custom.id}/permissions`, {
      cookie: limitedCookie,
      body: { permissions: submitted },
    });

    // Tout ce qui était offert passe. C'est le verrou : `delegatableActions` et
    // `undelegatableGrants` lisent la même règle, et doivent donc rendre le même verdict.
    expect(res.status).toBe(200);

    await db.delete(permission).where(eq(permission.role, custom.id));
    await db.delete(role).where(eq(role.id, custom.id));
  });
});
