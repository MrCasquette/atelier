import { beforeAll, describe, expect, it } from 'bun:test';
import { collection, db } from '@echoppe/core';
import { app } from '../src/app';
import { createAdminSession, migrate, requireSmokeDb } from './harness';

// Verrou audit2 #3 (visibilityFilter, ADR-0006) : une ressource invisible est 404 pour un anonyme,
// mais visible pour un principal privilégié (session admin). Le helper porte la règle de sécurité.
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

let adminCookie: string;

beforeAll(async () => {
  await migrate();
  adminCookie = await createAdminSession();
});

describe('audit2 #3 — filtre de visibilité (ADR-0006)', () => {
  it('collection invisible : 404 pour un anonyme, 200 pour un admin', async () => {
    const [hidden] = await db
      .insert(collection)
      .values({ name: 'Secrète', slug: 'secrete-collection', isVisible: false })
      .returning();

    const anon = await app.handle(new Request(`http://localhost/collections/${hidden.id}`));
    expect(anon.status).toBe(404);

    const admin = await app.handle(
      new Request(`http://localhost/collections/${hidden.id}`, {
        headers: { cookie: adminCookie },
      }),
    );
    expect(admin.status).toBe(200);
  });

  it('collection invisible : absente de la liste publique', async () => {
    await db
      .insert(collection)
      .values({ name: 'Cachée liste', slug: 'cachee-liste', isVisible: false })
      .returning();

    const list = (await (
      await app.handle(new Request('http://localhost/collections?limit=100'))
    ).json()) as { data: { slug: string }[] };
    expect(list.data.some((c) => c.slug === 'cachee-liste')).toBe(false);
  });
});
