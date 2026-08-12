import { beforeAll, describe, expect, it } from 'bun:test';
import { db, legalEntity, page, section, site } from '@echoppe/core';
import { invalidateRegistryCache } from '@repo/pages';
import { createAdminSession, migrate, req, requireSmokeDb } from './harness';

// Interpolation de variables (ADR-0035, V1 humble).
//
// Le stockage garde `{{ legal.name }}` en clair ; la substitution a lieu À LA LECTURE. Ce fichier
// vérifie surtout ce que le mécanisme REFUSE de faire — c'est là qu'est la décision.
//
// ⚠️ Base JETABLE via `bun run test:smoke` uniquement.
requireSmokeDb();

let ownerCookie: string;

const SLUG = `mentions-${crypto.randomUUID().slice(0, 8)}`;

/** Les sections de la page publiée, telles que la surface publique les rend. */
async function published(): Promise<{ type: string; data: Record<string, unknown> }[]> {
  const res = await req('GET', `/pages/by-slug/${SLUG}`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    sections: { type: string; data: Record<string, unknown> }[];
  };
  return body.sections;
}

const dataOf = async (type: string): Promise<Record<string, unknown>> => {
  const found = (await published()).find((s) => s.type === type);
  if (!found) throw new Error(`Section ${type} absente`);
  return found.data;
};

beforeAll(async () => {
  await migrate();
  ownerCookie = await createAdminSession();

  // Identité : la source des variables. `siren` reste VIDE — c'est le cas « inconnu » du test.
  await db.delete(legalEntity);
  await db.delete(site);
  await db.insert(site).values({ name: 'Atelier *Étoile*', publicEmail: 'bonjour@atelier.test' });
  await db.insert(legalEntity).values({ name: 'Atelier [Étoile] SASU', city: 'Nantes' });

  const pushed = await req('PUT', '/content/registry', {
    cookie: ownerCookie,
    body: {
      version: 1,
      components: {
        encart: {
          name: 'encart',
          fields: { note: { kind: 'richText' } },
        },
      },
      sections: {
        legal: {
          name: 'legal',
          fields: {
            titre: { kind: 'text' },
            corps: { kind: 'richText' },
            reference: { kind: 'text' },
            encart: { kind: 'component', of: 'encart' },
            lignes: { kind: 'repeater', fields: { texte: { kind: 'text' } } },
          },
        },
      },
    },
  });
  if (pushed.status !== 200) throw new Error(`Registre refusé : ${pushed.status}`);
  invalidateRegistryCache();

  const [created] = await db
    .insert(page)
    .values({ slug: SLUG, title: 'Mentions légales', status: 'published' })
    .returning();

  await db.insert(section).values({
    page: created.id,
    type: 'legal',
    sort: 0,
    data: {
      titre: 'Mentions légales de {{ site.name }}',
      corps: 'Éditeur : {{ legal.name }}, à {{ legal.city }}. SIREN {{ legal.siren }}.',
      reference: '{{ legal.name }}',
      encart: { note: 'Contact : {{ site.email }}' },
      lignes: [{ texte: 'Siège : {{ legal.city }}' }, { texte: 'Inconnue : {{ legal.nawak }}' }],
    },
  });
});

describe('ce que la substitution remplace', () => {
  it('résout dans un champ texte', async () => {
    const data = await dataOf('legal');

    expect(data.titre).toBe('Mentions légales de Atelier *Étoile*');
  });

  it('descend dans un composant et dans un répéteur', async () => {
    const data = await dataOf('legal');

    // Le texte rédigé d'une page vit autant là qu'au premier niveau.
    expect((data.encart as { note: string }).note).toBe('Contact : bonjour@atelier.test');
    expect((data.lignes as { texte: string }[])[0].texte).toBe('Siège : Nantes');
  });
});

describe('ce que la substitution refuse', () => {
  it('laisse le littéral d’une variable non renseignée — jamais un trou blanc', async () => {
    const data = await dataOf('legal');

    // `siren` n'est pas rempli. Une mention légale avec un vide passe inaperçue ; le littéral, non.
    expect(data.corps).toContain('SIREN {{ legal.siren }}.');
  });

  it('laisse le littéral d’une variable qui n’existe pas au jeu déclaré', async () => {
    const data = await dataOf('legal');

    expect((data.lignes as { texte: string }[])[1].texte).toBe('Inconnue : {{ legal.nawak }}');
  });

  it('échappe la valeur injectée dans du Markdown, mais pas dans du texte', async () => {
    const data = await dataOf('legal');

    // `richText` est du Markdown (ADR-0030) : des crochets dans une raison sociale ne doivent pas
    // fabriquer un lien.
    expect(data.corps).toContain('Éditeur : Atelier \\[Étoile\\] SASU');
    // `text` n'en est pas : l'échapper afficherait des antislashs à l'écran.
    expect(data.reference).toBe('Atelier [Étoile] SASU');
  });
});

// L'INVARIANT d'ADR-0035. Ces cas ne décrivent pas un manque à combler : ils verrouillent une
// interdiction. Le jour où l'un d'eux « échoue », c'est qu'on a laissé entrer un évaluateur.
describe('substituer, jamais évaluer', () => {
  const contents = [
    '{{ 1 + 1 }}',
    '{{ site.name.toUpperCase() }}',
    '{{ if legal.siren }}oui{{ end }}',
    '{{ legal.name | upper }}',
    '{{ constructor.constructor("return 1")() }}',
    '{{ __proto__ }}',
  ];

  it.each(contents)('laisse %s intact', async (raw) => {
    const [created] = await db
      .insert(page)
      .values({
        slug: `expr-${crypto.randomUUID().slice(0, 8)}`,
        title: 'Expression',
        status: 'published',
      })
      .returning();

    await db.insert(section).values({
      page: created.id,
      type: 'legal',
      sort: 0,
      data: { titre: raw },
    });

    const res = await req('GET', `/pages/by-slug/${created.slug}`);
    const body = (await res.json()) as { sections: { data: { titre: string } }[] };

    expect(body.sections[0].data.titre).toBe(raw);
  });

  it('ne re-balaie jamais ce qu’elle vient d’insérer — une seule passe', async () => {
    // Le nom du site contient lui-même une accolade ouvrante : si le résultat était re-balayé, une
    // valeur auto-référente ferait boucler la résolution.
    await db.update(site).set({ name: '{{ site.name }}' });

    const [created] = await db
      .insert(page)
      .values({
        slug: `passe-${crypto.randomUUID().slice(0, 8)}`,
        title: 'Une passe',
        status: 'published',
      })
      .returning();

    await db
      .insert(section)
      .values({ page: created.id, type: 'legal', sort: 0, data: { titre: '{{ site.name }}' } });

    const res = await req('GET', `/pages/by-slug/${created.slug}`);
    const body = (await res.json()) as { sections: { data: { titre: string } }[] };

    // Substitué une fois, puis laissé tel quel.
    expect(body.sections[0].data.titre).toBe('{{ site.name }}');

    await db.update(site).set({ name: 'Atelier *Étoile*' });
  });
});
