import { beforeAll, describe, expect, it } from 'bun:test';
import { permission, role, session, user } from '@repo/auth';
import { db } from '@repo/db';
import { createAdminSession, migrate, req, requireDisposableDb } from './harness';

// `PUT /content/registry` était gardé par `content:update` — le droit d'ÉDITER.
//
// C'était une confusion de nature : pousser un registre ne modifie pas un contenu, il redéfinit ce
// qu'EST un contenu, et peut invalider des données existantes. Un éditeur ne doit pouvoir
// qu'éditer. La route passe donc sous `schema`, qui tient au rang (ADR-0038, amendement du
// 2026-08-10) — le même droit que le push d'entités, un seul geste CLI, un seul droit.
//
// ⚠️ Base JETABLE via `bun run test:api` uniquement.
requireDisposableDb();

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

// #46 puis ADR-0049 — l'ordre déclaré traverse la frontière HTTP et le stockage.
//
// Le défaut d'origine : `content_definition.fields` était un objet en `jsonb`, qui trie les clés par
// longueur puis octet, donc le formulaire d'édition affichait les champs dans un ordre que le dev
// n'avait pas choisi. #46 avait déplacé la colonne en `json` ; ADR-0049 a déplacé l'ORDRE dans une
// séquence, ce qui rend `jsonb` de nouveau sûr — un tableau est ordonné par construction.
describe('l’ordre des champs déclarés survit au stockage', () => {
  // Choisis pour tomber : sur un objet en `jsonb`, ils ressortaient `a, corps, titre, sous_titre`.
  const declared = ['titre', 'sous_titre', 'corps', 'a'];

  it('rend les champs d’une section dans l’ordre où le dev les a écrits', async () => {
    const pushed = await req('PUT', '/content/registry', {
      cookie: ownerCookie,
      body: {
        version: 1,
        components: {},
        sections: {
          heros: {
            name: 'heros',
            label: 'Héros',
            fields: [
              { name: 'titre', kind: 'text', required: true },
              { name: 'sous_titre', kind: 'text' },
              { name: 'corps', kind: 'richText' },
              { name: 'a', kind: 'text' },
            ],
          },
        },
      },
    });
    expect(pushed.status).toBe(200);

    const res = await req('GET', '/content/registry', { cookie: ownerCookie });
    const registry = (await res.json()) as {
      sections: Record<string, { fields: { name: string }[] }>;
    };

    expect(registry.sections.heros.fields.map((field) => field.name)).toEqual(declared);
  });

  it('refuse un nom de champ que JavaScript réordonnerait', async () => {
    // La borne d'ADR-0049 : `{ '2024': … }` est déjà brouillé dans l'objet littéral du dev, avant
    // toute sérialisation. Ni la séquence ni le stockage ne peuvent le rattraper — d'où un refus à
    // la frontière plutôt qu'une promesse d'ordre qu'on ne tiendrait pas.
    const pushed = await req('PUT', '/content/registry', {
      cookie: ownerCookie,
      body: {
        version: 1,
        components: {},
        sections: {
          archive: {
            name: 'archive',
            fields: [
              { name: 'titre', kind: 'text' },
              { name: '2024', kind: 'text' },
            ],
          },
        },
      },
    });

    expect(pushed.status).toBe(422);
  });

  it('refuse deux champs de même nom, que la séquence autorise', async () => {
    // L'objet donnait cette garantie gratuitement — deux clés identiques ne coexistent pas. Le
    // tableau l'admet, donc elle se vérifie (`duplicateFieldNames`).
    const pushed = await req('PUT', '/content/registry', {
      cookie: ownerCookie,
      body: {
        version: 1,
        components: {},
        sections: {
          doublon: {
            name: 'doublon',
            fields: [
              { name: 'titre', kind: 'text' },
              { name: 'titre', kind: 'richText' },
            ],
          },
        },
      },
    });

    expect(pushed.status).toBe(422);
    expect(await pushed.text()).toContain('titre');
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
