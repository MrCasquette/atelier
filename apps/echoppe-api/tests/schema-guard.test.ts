import { beforeAll, describe, expect, it } from 'bun:test';
import { db, permission, role, session, user } from '@echoppe/core';
import { createAdminSession, migrate, req, requireSmokeDb } from './harness';

// `PUT /content/registry` était gardé par `content:update` — le droit d'ÉDITER.
//
// C'était une confusion de nature : pousser un registre ne modifie pas un contenu, il redéfinit ce
// qu'EST un contenu, et peut invalider des données existantes. Un éditeur ne doit pouvoir
// qu'éditer. La route passe donc sous `schema`, qui tient au rang (ADR-0038, amendement du
// 2026-08-10) — le même droit que le push d'entités, un seul geste CLI, un seul droit.
//
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

let ownerCookie: string;
let editorCookie: string;

/** Rôle qui édite le contenu à fond, et ne touche pas à sa structure. */
async function createEditorSession(): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [editorRole] = await db
    .insert(role)
    .values({ name: `Éditeur ${suffix}`, scope: 'admin' })
    .returning();

  await db.insert(permission).values({
    role: editorRole.id,
    resource: 'content',
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
  });

  const [editorUser] = await db
    .insert(user)
    .values({
      email: `editeur-${suffix}@echoppe.test`,
      passwordHash: 'x',
      firstName: 'Éditeur',
      lastName: 'Test',
      role: editorRole.id,
      isOwner: false,
    })
    .returning();

  const token = crypto.randomUUID().replace(/-/g, '');
  await db
    .insert(session)
    .values({ token, user: editorUser.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return `echoppe_admin_session=${token}`;
}

const EMPTY_REGISTRY = { version: 1, sections: {}, components: {} };

const pushRegistry = (cookie: string) =>
  req('PUT', '/content/registry', { cookie, body: EMPTY_REGISTRY });

beforeAll(async () => {
  await migrate();
  ownerCookie = await createAdminSession();
  editorCookie = await createEditorSession();
});

// #46 — l'autre moitié du défaut. Les sections l'avaient depuis toujours : `content_definition.fields`
// était en `jsonb`, qui réordonne les clés, donc le formulaire d'édition affichait les champs dans
// un ordre que le dev n'avait pas choisi.
describe('l’ordre des champs déclarés survit au stockage', () => {
  it('rend les champs d’une section dans l’ordre où le dev les a écrits', async () => {
    const declared = ['titre', 'sous_titre', 'corps', 'a'];

    const pushed = await req('PUT', '/content/registry', {
      cookie: ownerCookie,
      body: {
        version: 1,
        components: {},
        sections: {
          heros: {
            name: 'heros',
            label: 'Héros',
            fields: {
              // Choisis pour tomber : `jsonb` trie par longueur puis octet, donc il rendrait
              // `a, corps, titre, sous_titre` — un ordre que personne n'a demandé.
              titre: { kind: 'text', required: true },
              sous_titre: { kind: 'text' },
              corps: { kind: 'richText' },
              a: { kind: 'text' },
            },
          },
        },
      },
    });
    expect(pushed.status).toBe(200);

    const res = await req('GET', '/content/registry', { cookie: ownerCookie });
    const registry = (await res.json()) as {
      sections: Record<string, { fields: Record<string, unknown> }>;
    };

    expect(Object.keys(registry.sections.heros.fields)).toEqual(declared);
  });
});

describe('pousser un registre est un acte de structure', () => {
  it('refuse un éditeur qui détient pourtant `content` en entier', async () => {
    const res = await pushRegistry(editorCookie);

    expect(res.status).toBe(403);
  });

  it('laisse lire le registre à qui détient `content:read`', async () => {
    // La lecture reste du contenu : l'admin en a besoin pour générer ses formulaires.
    const res = await req('GET', '/content/registry', { cookie: editorCookie });

    expect(res.status).toBe(200);
  });

  it("le propriétaire de l'installation pousse", async () => {
    const res = await pushRegistry(ownerCookie);

    expect(res.status).toBe(200);
  });
});
