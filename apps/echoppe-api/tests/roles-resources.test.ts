import { beforeAll, describe, expect, it } from 'bun:test';
import { permission, role, session, user } from '@repo/auth';
import { entityDefinition } from '@repo/entities';
import { db, eq } from '@repo/db';
import { invalidatePermissionCache, invalidateSystemRoleCache } from '@repo/auth';
import {
  createAdminSession,
  migrate,
  record,
  records,
  req,
  requireDisposableDb,
  strings,
} from './harness';

// `GET /roles/resources` est la SEULE liste de ce qui est protégeable (#38).
//
// L'écran des rôles tenait la sienne, à la main : `content`, `api_key` et `schema` existaient dans
// RESOURCES sans jamais y apparaître, donc sans jamais pouvoir être accordés depuis l'interface. Le
// correctif ne vaut que si cette route dit vraiment TOUT — vocabulaire du socle ET entités
// déclarées, que rien de compilé ne peut connaître à l'avance (ADR-0038).
//
// ⚠️ Base JETABLE via `bun run integration echoppe api` uniquement.
requireDisposableDb();

let ownerCookie: string;
let limitedCookie: string;
let administratorCookie: string;

async function resources(cookie: string = ownerCookie): Promise<Record<string, unknown>[]> {
  const res = await req('GET', '/roles/resources', { cookie });
  expect(res.status).toBe(200);
  return records(record(await res.json()).resources, 'resources');
}

const named = (
  list: Record<string, unknown>[],
  name: string,
): Record<string, unknown> | undefined =>
  list.find((resource) => resource.name === name);

/** Une session pour un utilisateur donné, sans passer par `/auth/login`. */
async function sessionFor(userId: string): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, '');
  await db
    .insert(session)
    .values({ token, user: userId, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return `echoppe_admin_session=${token}`;
}

/**
 * Un ADMINISTRATEUR — le rôle `admin`, sans le drapeau de propriété. Son autorité est définie par
 * soustraction (ADR-0047), et elle est bornée à ses propres lignes sur `api_key`. C'est le seul
 * principal du socle qui détient un droit sans le détenir entièrement.
 */
async function administratorSession(): Promise<string> {
  const [administrator] = await db.select().from(role).where(eq(role.key, 'admin'));

  const [created] = await db
    .insert(user)
    .values({
      email: `admin-${crypto.randomUUID().slice(0, 8)}@echoppe.test`,
      passwordHash: 'x',
      firstName: 'Admin',
      lastName: 'Second',
      role: administrator.id,
      isOwner: false,
    })
    .returning();

  return sessionFor(created.id);
}

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

  return sessionFor(limited.id);
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
          fields: [{ name: 'titre', kind: 'text', maxLength: 200, required: true }],
        },
      },
    },
  });
  if (pushed.status !== 200) throw new Error(`Préparation impossible : push ${pushed.status}`);

  limitedCookie = await limitedSession();
  administratorCookie = await administratorSession();
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

    expect(strings(product?.actions, 'actions').toSorted()).toEqual(['create', 'delete', 'read', 'update']);
  });

  it("ne propose d'une ressource que les actions détenues", async () => {
    const product = named(await resources(limitedCookie), 'product');

    // `product:delete` n'est pas détenu : il ne doit pas être proposé.
    expect(strings(product?.actions, 'actions').toSorted()).toEqual(['create', 'read', 'update']);
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

  // L'AUTRE dimension de la même règle. Un droit peut être borné aux lignes dont on est le sujet,
  // et cette borne se délègue avec lui. La liste l'ignorait : l'écran offrait la ressource sans la
  // borne, l'enregistrement la refusait — et la colonne « Self only » ne sortant que pour les rôles
  // publics, un administrateur n'avait aucune case à cocher pour s'y conformer. Impasse.
  describe('la borne aux propres lignes voyage avec le droit', () => {
    it("annonce la borne que l'administrateur porte sur ses clés d'API", async () => {
      const apiKey = named(await resources(administratorCookie), 'api_key');

      expect(apiKey?.selfOnlyRequired).toBe(true);
    });

    it("ne l'annonce pas là où le droit est entier", async () => {
      const product = named(await resources(administratorCookie), 'product');

      expect(product?.selfOnlyRequired).toBe(false);
    });

    it("ne l'annonce à personne pour le propriétaire, que rien ne borne", async () => {
      const apiKey = named(await resources(), 'api_key');

      expect(apiKey?.selfOnlyRequired).toBe(false);
    });

    it('et le serveur refuse bien de la perdre en chemin', async () => {
      const [target] = await db
        .insert(role)
        .values({ name: `Borne ${crypto.randomUUID().slice(0, 8)}`, scope: 'admin' })
        .returning();

      const grant = (selfOnly: boolean) =>
        req('PUT', `/roles/${target.id}/permissions`, {
          cookie: administratorCookie,
          body: {
            permissions: [
              {
                resource: 'api_key',
                canCreate: false,
                canRead: true,
                canUpdate: false,
                canDelete: false,
                selfOnly,
              },
            ],
          },
        });

      // Sans la borne : accorder plus large que ce qu'on détient.
      expect((await grant(false)).status).toBe(403);
      // Avec : c'est exactement ce que la liste annonçait.
      expect((await grant(true)).status).toBe(200);

      await db.delete(permission).where(eq(permission.role, target.id));
      await db.delete(role).where(eq(role.id, target.id));
    });
  });

  /**
   * LE verrou : tout ce que la route offre, l'enregistrement l'accepte. `delegatableActions` et
   * `undelegatableGrants` lisent la même règle et doivent rendre le même verdict — sur les actions
   * comme sur la borne aux propres lignes. On resoumet EXACTEMENT ce qui a été offert.
   */
  async function offeredIsAccepted(cookie: string): Promise<number> {
    const [target] = await db
      .insert(role)
      .values({ name: `Cible ${crypto.randomUUID().slice(0, 8)}`, scope: 'admin' })
      .returning();

    const submitted = (await resources(cookie)).map((resource) => ({
      resource: resource.name,
      canCreate: strings(resource.actions, 'actions').includes('create'),
      canRead: strings(resource.actions, 'actions').includes('read'),
      canUpdate: strings(resource.actions, 'actions').includes('update'),
      canDelete: strings(resource.actions, 'actions').includes('delete'),
      selfOnly: resource.selfOnlyRequired,
    }));

    const res = await req('PUT', `/roles/${target.id}/permissions`, {
      cookie,
      body: { permissions: submitted },
    });

    await db.delete(permission).where(eq(permission.role, target.id));
    await db.delete(role).where(eq(role.id, target.id));
    return res.status;
  }

  it("ne propose à un rôle étroit que ce que l'enregistrement lui accepte", async () => {
    expect(await offeredIsAccepted(limitedCookie)).toBe(200);
  });

  it("ne propose à un administrateur que ce que l'enregistrement lui accepte", async () => {
    // Celui-ci passe par les deux dimensions : des actions retirées (`audit_log`) et une borne
    // exigée (`api_key`).
    expect(await offeredIsAccepted(administratorCookie)).toBe(200);
  });
});
