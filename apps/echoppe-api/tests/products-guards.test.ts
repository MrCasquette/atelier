import { beforeAll, describe, expect, it } from 'bun:test';
import { createAdminSession, migrate, req, requireSmokeDb } from './harness';

// Filet de sécurité AVANT le découpage de products.ts (audit2 #6b) : verrouille la matrice RBAC des
// routes produits — chaque sous-ressource protégée refuse l'anonyme (403), les publiques passent
// (200), et l'owner franchit les guards. Si le découpage égare un guard, une route protégée
// répondra 2xx à un anonyme → ce test casse.
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

const UUID = '00000000-0000-4000-8000-000000000000';

let adminCookie: string;

beforeAll(async () => {
  await migrate();
  adminCookie = await createAdminSession();
});

// Corps valides (pour atteindre le guard sans buter sur la validation TypeBox).
const productBody = { name: 'X', category: UUID, taxRate: UUID };
const variantBody = { priceHt: 10 };
const fieldBody = { label: 'X' };
const mediaBody = { mediaId: UUID };
const optionBody = { name: 'Taille' };

describe('audit2 #6b — matrice RBAC des routes produits', () => {
  it('routes protégées : anonyme → 403', async () => {
    const cases: Array<[string, string, unknown?]> = [
      ['POST', '/products', productBody], // product:create
      ['PUT', `/products/${UUID}`, productBody], // product:update
      ['PATCH', `/products/${UUID}`, { name: 'X' }], // product:update
      ['DELETE', `/products/${UUID}`], // product:delete
      ['POST', `/products/${UUID}/variants`, variantBody], // variant:create
      ['PUT', `/products/${UUID}/variants/${UUID}`, variantBody], // variant:update
      ['DELETE', `/products/${UUID}/variants/${UUID}`], // variant:delete
      ['GET', '/products/admin'], // product:read adminOnly (Public a product:read !)
      ['GET', `/products/${UUID}/full`], // product:read adminOnly
      ['POST', `/products/${UUID}/personalization-fields`, fieldBody], // product:update
      ['POST', `/products/${UUID}/media`, mediaBody], // product:update
      ['GET', `/products/${UUID}/media`], // product (lecture admin)
      ['PUT', `/products/${UUID}/media/${UUID}`, { sortOrder: 1 }], // product:update
      ['DELETE', `/products/${UUID}/media/${UUID}`], // product:delete
      ['PUT', `/products/${UUID}/personalization-fields/${UUID}`, fieldBody], // product:update
      ['DELETE', `/products/${UUID}/personalization-fields/${UUID}`], // product:update
      ['PUT', `/products/${UUID}/variants/${UUID}/options`, { optionValueIds: [] }], // variant:update
      ['GET', '/products/option-axes'], // option:read
      ['POST', `/products/${UUID}/option-axes`, optionBody], // option:create
      ['PUT', `/products/${UUID}/option-axes/${UUID}`, optionBody], // option:update
      ['DELETE', `/products/${UUID}/option-axes/${UUID}`], // option:delete
    ];
    for (const [method, path, body] of cases) {
      const res = await req(method, path, { body });
      expect(`${method} ${path} → ${res.status}`).toBe(`${method} ${path} → 403`);
    }
  });

  it('routes publiques : anonyme → 2xx/404 (jamais 403)', async () => {
    for (const path of ['/products', '/products/by-slug/inexistant', `/products/${UUID}`]) {
      const res = await req('GET', path);
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    }
  });

  it('owner : franchit le guard adminOnly (GET /products/admin → 200)', async () => {
    const res = await req('GET', '/products/admin', { cookie: adminCookie });
    expect(res.status).toBe(200);
  });
});
