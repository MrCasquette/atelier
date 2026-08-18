import { beforeAll, describe, expect, it } from 'bun:test';
import { db, entityDefinition, permission, role, session, user } from '@echoppe/core';
import { invalidatePermissionCache } from '@repo/auth';
import { createAdminSession, migrate, req, requireDisposableDb } from './harness';

// « Ce que je peux administrer » (#37) — la question de la NAVIGATION, distincte de celle du
// journal.
//
// Le journal complet tient à `schema:read`, et doit y tenir. Mais un rédacteur à qui l'on vient
// d'accorder `entity:<nom>` ne détient pas `schema` : sans cette route, il n'aurait aucun chemin
// vers son propre écran. Elle ne rend donc que ce qu'il détient, déclaration comprise — c'est ce
// dont le générateur de formulaires a besoin.
//
// ⚠️ Base JETABLE via `bun run test:api` uniquement.
requireDisposableDb();

let ownerCookie: string;
let redacteurCookie: string;
let redacteurRoleId: string;

type Granted = {
  name: string;
  label?: string;
  icon?: string;
  singleton: boolean;
  fields: Record<string, unknown>;
  actions: string[];
};

/** Rôle vierge : c'est ce qu'on lui accorde qui se vérifie, jamais ce qu'il aurait par défaut. */
async function createRedacteurSession(): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [created] = await db
    .insert(role)
    .values({ name: `Rédacteur mine ${suffix}`, scope: 'admin' })
    .returning();
  redacteurRoleId = created.id;

  const [redacteur] = await db
    .insert(user)
    .values({
      email: `redacteur-mine-${suffix}@echoppe.test`,
      passwordHash: 'x',
      firstName: 'Rédacteur',
      lastName: 'Mine',
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

async function grant(resource: string, actions: Partial<Record<string, boolean>>): Promise<void> {
  await db
    .insert(permission)
    .values({
      role: redacteurRoleId,
      resource,
      canCreate: actions.create === true,
      canRead: actions.read === true,
      canUpdate: actions.update === true,
      canDelete: actions.delete === true,
    })
    .onConflictDoNothing();
  invalidatePermissionCache();
}

const mine = async (cookie?: string): Promise<{ status: number; entities: Granted[] }> => {
  const res = await req('GET', '/content/entities/mine', cookie ? { cookie } : {});
  if (res.status !== 200) return { status: res.status, entities: [] };
  const body = (await res.json()) as { entities: Granted[] };
  return { status: res.status, entities: body.entities };
};

beforeAll(async () => {
  await migrate();
  ownerCookie = await createAdminSession();
  redacteurCookie = await createRedacteurSession();
  await db.delete(entityDefinition);

  const pushed = await req('PUT', '/content/entities', {
    cookie: ownerCookie,
    body: {
      entities: {
        depeche: {
          name: 'depeche',
          label: 'Dépêches',
          icon: 'M4 6h16',
          singleton: false,
          fields: [
            { name: 'titre', kind: 'text', required: true },
            { name: 'corps', kind: 'richText' },
          ],
        },
        entete: {
          name: 'entete',
          label: 'En-tête',
          singleton: true,
          fields: [{ name: 'slogan', kind: 'text' }],
        },
      },
    },
  });
  if (pushed.status !== 200) {
    const body = (await pushed.json()) as { message?: string };
    throw new Error(`Préparation impossible : push ${pushed.status} — ${body.message ?? ''}`);
  }
});

describe('on ne voit que ce qu’on détient', () => {
  it('ne rend rien à un rôle qui ne détient aucune entité', async () => {
    // Une entité fraîchement poussée n'est accordée à personne : sa navigation est vide, et c'est
    // le bon défaut (ADR-0028, résolu par ADR-0038).
    const { status, entities } = await mine(redacteurCookie);

    expect(status).toBe(200);
    expect(entities).toEqual([]);
  });

  it("rend l'entité dès qu'un rôle la détient en lecture, et elle seule", async () => {
    await grant('entity:depeche', { read: true });

    const { entities } = await mine(redacteurCookie);

    expect(entities.map((entity) => entity.name)).toEqual(['depeche']);
  });

  it("ne rend pas une entité dont on détient l'écriture sans la lecture", async () => {
    // `read` commande la visibilité : pouvoir écrire sans pouvoir lire n'ouvre aucun écran.
    await grant('entity:entete', { create: true, update: true });

    expect((await mine(redacteurCookie)).entities.map((e) => e.name)).not.toContain('entete');
  });

  it('rend au propriétaire toutes les entités déclarées', async () => {
    const noms = (await mine(ownerCookie)).entities.map((entity) => entity.name).sort();

    expect(noms).toEqual(['depeche', 'entete']);
  });

  it("refuse l'anonyme : la déclaration est de l'administration", async () => {
    // Le rôle Public peut détenir `entity:<nom>` en lecture pour servir le front — ce n'est pas une
    // raison pour lui rendre la structure.
    expect((await mine()).status).toBe(403);
  });
});

describe('la réponse porte de quoi générer un écran', () => {
  it('rend la déclaration entière, champs compris', async () => {
    const depeche = (await mine(ownerCookie)).entities.find((e) => e.name === 'depeche');

    expect(depeche).toMatchObject({
      label: 'Dépêches',
      icon: 'M4 6h16',
      singleton: false,
    });
    // DANS L'ORDRE DÉCLARÉ. Le journal stockait un OBJET en `jsonb`, qui réordonne les clés — par
    // longueur puis octet —, donc `{ titre, corps }` ressortait `{ corps, titre }` et le formulaire
    // généré affichait les champs dans le désordre (#46). Depuis ADR-0049 l'ordre vit dans la
    // séquence, que `jsonb` préserve : c'est la position qui le porte, plus la forme du conteneur.
    expect(depeche?.fields.map((field) => field.name)).toEqual(['titre', 'corps']);
  });

  it('dit la cardinalité, qui décide de la forme de l’écran', async () => {
    // Liste ou formulaire direct : c'est le drapeau qui tranche, pas une préférence d'UI (ADR-0039).
    const entete = (await mine(ownerCookie)).entities.find((e) => e.name === 'entete');

    expect(entete?.singleton).toBe(true);
  });

  it('énumère les actions détenues, pour que l’écran n’offre pas ce qui sera refusé', async () => {
    const depeche = (await mine(redacteurCookie)).entities.find((e) => e.name === 'depeche');

    expect(depeche?.actions).toEqual(['read']);
  });

  it('rend toutes les actions au propriétaire', async () => {
    const depeche = (await mine(ownerCookie)).entities.find((e) => e.name === 'depeche');

    expect(depeche?.actions.sort()).toEqual(['create', 'delete', 'read', 'update']);
  });
});
