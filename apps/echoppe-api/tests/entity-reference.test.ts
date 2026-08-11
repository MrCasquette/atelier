import { beforeAll, describe, expect, it } from 'bun:test';
import { db, entityDefinition, sql } from '@echoppe/core';
import { createAdminSession, migrate, req, requireSmokeDb } from './harness';

// « Une entité déclarée devient référençable sans code » (ADR-0032, tenu par ADR-0046).
//
// Ce qui se vérifie ici n'est pas qu'une fonction rend la bonne chaîne — les tests unitaires s'en
// chargent — mais que la promesse tient de bout en bout : le dev ajoute une ligne à sa déclaration,
// et l'entité apparaît dans le sélecteur de l'administration, avec une URL utilisable.
//
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

let ownerCookie: string;

type Declaration = { name: string; singleton: boolean; fields: unknown; link?: unknown };
type Target = { name: string; label: string; route: string | null };
type Option = { id: string; slug: string; name: string; url?: string | null };

const push = (declarations: Declaration[]) =>
  req('PUT', '/content/entities', {
    cookie: ownerCookie,
    body: {
      entities: Object.fromEntries(declarations.map((d) => [d.name, d])),
      confirmDestructive: true,
    },
  });

/** Pousse et exige un succès — en rapportant le refus du serveur si ce n'en est pas un. */
const pushOk = async (declarations: Declaration[]): Promise<void> => {
  const res = await push(declarations);
  if (res.status !== 200) {
    const body = (await res.json()) as { message?: string };
    throw new Error(`push ${res.status} : ${body.message ?? '(sans message)'}`);
  }
};

const targets = async (): Promise<Target[]> => {
  const res = await req('GET', '/content/reference-targets', { cookie: ownerCookie });
  expect(res.status).toBe(200);
  return (await res.json()) as Target[];
};

const options = async (name: string): Promise<Option[]> => {
  const res = await req('GET', `/content/reference-targets/${encodeURIComponent(name)}/options`, {
    cookie: ownerCookie,
  });
  expect(res.status).toBe(200);
  return (await res.json()) as Option[];
};

// Trois entités, une par mode de lien — plus une quatrième qui se tait.
const chronique: Declaration = {
  name: 'chronique',
  singleton: false,
  fields: { titre: { kind: 'text' } },
  link: { mode: 'route', route: '/blog/:slug' },
};

const lien_social: Declaration = {
  name: 'lien_social',
  singleton: false,
  fields: { nom: { kind: 'text' }, adresse: { kind: 'text' } },
  link: { mode: 'href', field: 'adresse' },
};

const ancre_test: Declaration = {
  name: 'ancre_test',
  singleton: false,
  fields: { titre: { kind: 'text' }, parent: { kind: 'ref', to: 'page' } },
  link: { mode: 'anchor', parent: 'parent' },
};

const prive: Declaration = {
  name: 'prive',
  singleton: false,
  fields: { note: { kind: 'text' } },
};

beforeAll(async () => {
  await migrate();
  ownerCookie = await createAdminSession();
  await db.delete(entityDefinition);

  await pushOk([chronique, lien_social, ancre_test, prive]);
});

describe('une entité déclarée entre au registre', () => {
  it("s'inscrit sous `entity:<nom>`, avec son libellé et sa route", async () => {
    const inscrites = await targets();

    expect(inscrites).toContainEqual({
      name: 'entity:chronique',
      label: 'chronique',
      route: '/blog/:slug',
    });
  });

  it("n'inscrit PAS une entité qui ne déclare aucun lien", async () => {
    // Ce qui rend une entité référençable est d'avoir une URL, pas d'être déclarée (ADR-0032).
    expect((await targets()).map((t) => t.name)).not.toContain('entity:prive');
  });

  it('ne touche pas aux cibles que le produit a inscrites à son import', async () => {
    const noms = (await targets()).map((t) => t.name);

    expect(noms).toContain('page');
    expect(noms).toContain('product');
  });

  it('retire du registre une entité que la déclaration ne cite plus', async () => {
    await pushOk([lien_social, ancre_test, prive]);
    expect((await targets()).map((t) => t.name)).not.toContain('entity:chronique');

    // Remise en place pour les cas suivants.
    await pushOk([chronique, lien_social, ancre_test, prive]);
  });
});

describe('les occurrences se cherchent et se projettent', () => {
  beforeAll(async () => {
    await db.execute(sql`insert into entity_chronique (slug, titre) values ('premier', 'Premier')`);
    await db.execute(
      sql`insert into entity_lien_social (slug, nom, adresse) values ('mastodon', 'Mastodon', 'https://mastodon.social/@echoppe')`,
    );
  });

  it("rend le premier champ texte comme libellé, sans qu'on ait eu à le désigner", async () => {
    const [premier] = await options('entity:chronique');

    expect(premier).toMatchObject({ slug: 'premier', name: 'Premier' });
  });

  it("ne calcule pas d'URL en mode route : le slug et la route déclarée suffisent", async () => {
    const [premier] = await options('entity:chronique');

    expect(premier.url ?? null).toBeNull();
  });

  it("rend l'URL que l'entité PORTE, en mode href", async () => {
    const [mastodon] = await options('entity:lien_social');

    expect(mastodon.url).toBe('https://mastodon.social/@echoppe');
  });
});

describe('une ancre se dérive de son entité parente', () => {
  let pageId: string;

  beforeAll(async () => {
    const [created] = await db.execute<{ id: string }>(
      sql`insert into page (slug, title, status) values ('a-propos', 'À propos', 'published') returning id`,
    );
    pageId = created.id;
    await db.execute(
      sql`insert into entity_ancre_test (slug, titre, parent) values ('tarifs', 'Tarifs', ${pageId})`,
    );
  });

  it("compose la route du parent et le slug de l'occurrence", async () => {
    // Deux niveaux de projection, irréductibles : le lien d'une ancre n'est pas dans sa propre
    // ligne. La cible parente sait où elle vit, `linkUrl` sait en tirer une URL.
    const [tarifs] = await options('entity:ancre_test');

    expect(tarifs.url).toBe('/a-propos#tarifs');
  });

  it("rend null quand le parent n'est pas renseigné — un lien cassé, pas une panne", async () => {
    await db.execute(
      sql`insert into entity_ancre_test (slug, titre) values ('orphelin', 'Orphelin')`,
    );

    const orphelin = (await options('entity:ancre_test')).find((o) => o.slug === 'orphelin');

    expect(orphelin?.url ?? null).toBeNull();
  });
});

// Ce qu'ADR-0045 avait anticipé sans pouvoir l'éprouver autrement que par une table externe : une
// entité inscrite déclare son `storage`, donc un `ref` vers elle porte une VRAIE clé étrangère.
describe('une entité citable hérite de ses clés étrangères', () => {
  // Deux entités poussées ENSEMBLE, dont l'une référence l'autre : la cible n'est pas encore
  // inscrite au registre au moment du plan, et la contrainte doit quand même être posée.
  const socle: Declaration = {
    name: 'socle',
    singleton: false,
    fields: { titre: { kind: 'text' } },
    link: { mode: 'route', route: '/socle/:slug' },
  };

  const avis: Declaration = {
    name: 'avis',
    singleton: false,
    fields: { titre: { kind: 'text' }, sujet: { kind: 'ref', to: 'entity:socle' } },
  };

  it('contraint un champ ref qui vise une entité, dès le premier push', async () => {
    await pushOk([chronique, lien_social, ancre_test, prive, socle, avis]);

    const contraintes = await db.execute<{ foreign_table: string }>(sql`
      select ccu.table_name as foreign_table
      from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
      where tc.table_name = 'entity_avis' and tc.constraint_type = 'FOREIGN KEY'
    `);

    expect(contraintes.map((c) => c.foreign_table)).toEqual(['entity_socle']);
  });

  it("refuse de supprimer l'entité tant qu'on la référence, en nommant ce qui retient", async () => {
    // `socle` est vide : ce n'est donc PAS la garde d'ADR-0028 qui parle ici, mais bien la clé
    // étrangère entrante — le second motif de refus qu'ADR-0045 ajoute.
    const res = await push([chronique, lien_social, ancre_test, prive, avis]);

    expect(res.status).toBe(422);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain('entity_avis');
    expect(body.message).toContain('jamais de cascade');
  });
});
