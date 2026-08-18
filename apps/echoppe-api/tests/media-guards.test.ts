import { beforeAll, describe, expect, it } from 'bun:test';
import { createAdminSession, migrate, req, requireDisposableDb } from './harness';

// Filet posé AVEC le découpage de `routes/media.ts` en `modules/media/` (ADR-0042). Le découpage
// scinde une instance Elysia unique en trois — dossiers, fichiers, livraison publique — et fait
// donc peser deux risques précis, tous deux silencieux :
//
// 1. un `permissionGuard` égaré : une route protégée répondrait 2xx à un anonyme ;
// 2. l'ordre de déclaration perdu : `/media/folders` doit être posé AVANT `/media/:id`, sinon la
//    liste des dossiers part dans le handler de fiche média.
//
// ⚠️ Base JETABLE via `bun run test:api` uniquement.
requireDisposableDb();

const UUID = '00000000-0000-4000-8000-000000000000';

let adminCookie: string;

beforeAll(async () => {
  await migrate();
  adminCookie = await createAdminSession();
});

describe('médiathèque — matrice RBAC', () => {
  it('routes protégées : anonyme → 403', async () => {
    const cases: Array<[string, string, unknown?]> = [
      ['GET', '/media'], // media:read
      ['GET', `/media/${UUID}`], // media:read
      ['GET', '/media/folders'], // media:read
      ['POST', '/media/folders', { name: 'X' }], // media:create
      ['PUT', `/media/folders/${UUID}`, { name: 'X' }], // media:update
      ['DELETE', `/media/folders/${UUID}`], // media:delete
      ['PUT', `/media/${UUID}`, { title: 'X' }], // media:update
      ['PUT', '/media/batch/move', { ids: [UUID], folder: null }], // media:update
      ['DELETE', `/media/${UUID}`], // media:delete
      ['DELETE', '/media/batch', { ids: [UUID] }], // media:delete
    ];

    for (const [method, path, body] of cases) {
      const res = await req(method, path, { body });
      expect(`${method} ${path} → ${res.status}`).toBe(`${method} ${path} → 403`);
    }
  });

  it("la livraison publique d'un fichier ne passe par aucun guard", async () => {
    // 404 et non 403 : `/assets/:id` est la seule surface anonyme du module.
    const res = await req('GET', `/assets/${UUID}`);
    expect(res.status).toBe(404);
  });

  it("l'owner franchit les guards des trois contrôleurs", async () => {
    const list = await req('GET', '/media', { cookie: adminCookie });
    expect(list.status).toBe(200);

    const folders = await req('GET', '/media/folders', { cookie: adminCookie });
    expect(folders.status).toBe(200);
    // Preuve que `/media/folders` n'est pas tombé dans `/media/:id` : un tableau, pas un objet.
    expect(Array.isArray(await folders.json())).toBe(true);

    const created = await req('POST', '/media/folders', {
      cookie: adminCookie,
      body: { name: `Dossier ${crypto.randomUUID().slice(0, 8)}` },
    });
    expect(created.status).toBe(200);
  });
});
