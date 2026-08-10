import { beforeAll, describe, expect, it } from 'bun:test';
import { db, entityDefinition } from '@echoppe/core';
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

type Resource = { name: string; label: string | null };

async function resources(): Promise<Resource[]> {
  const res = await req('GET', '/roles/resources', { cookie: ownerCookie });
  expect(res.status).toBe(200);
  return ((await res.json()) as { resources: Resource[] }).resources;
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
    const fiche = (await resources()).find((resource) => resource.name === 'entity:fiche');

    expect(fiche).toEqual({ name: 'entity:fiche', label: 'Fiche pratique' });
  });

  it("ne prête aucun libellé au vocabulaire du socle : c'est l'interface qui le traduit", async () => {
    const product = (await resources()).find((resource) => resource.name === 'product');

    expect(product).toEqual({ name: 'product', label: null });
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
