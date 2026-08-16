import { describe, expect, test } from 'bun:test';
import { incoherentLinks, type LinkDeclaration } from './link';

// Cohérence d'un `link` avec les champs de son entité (ADR-0046).
//
// Le DSL refuse déjà ces déclarations au dev, mais rien ne garantit qu'un registre poussé soit
// passé par ce chemin — une clé d'API pousse ce qu'elle veut. C'est la frontière qui tranche, et
// c'est ici qu'elle se teste : la fonction est pure.

type Checked = {
  name: string;
  singleton: boolean;
  link?: LinkDeclaration;
  fields: { name: string; kind: string }[];
};

const article = (over: Partial<Checked> = {}): Checked => ({
  name: 'article',
  singleton: false,
  fields: [
    { name: 'titre', kind: 'text' },
    { name: 'url', kind: 'text' },
    { name: 'page', kind: 'ref' },
  ],
  ...over,
});

const registryOf = (...declarations: Checked[]) =>
  Object.fromEntries(declarations.map((declaration) => [declaration.name, declaration]));

describe('cohérence du lien déclaré', () => {
  test("ne dit rien d'une entité qui ne se cite pas", () => {
    expect(incoherentLinks(registryOf(article()))).toEqual([]);
  });

  test('accepte une route de liste qui porte son slug', () => {
    const link = { mode: 'route', route: '/blog/:slug' } as const;
    expect(incoherentLinks(registryOf(article({ link })))).toEqual([]);
  });

  test('refuse une route de liste sans slug', () => {
    // Toutes les occurrences porteraient la même URL — un lien qui ne distingue rien.
    const link = { mode: 'route', route: '/blog' } as const;
    expect(incoherentLinks(registryOf(article({ link })))).toEqual([
      { path: 'article', reason: 'link_cardinality' },
    ]);
  });

  test("refuse un slug sur un singleton, qui n'en a pas", () => {
    const link = { mode: 'route', route: '/cgv/:slug' } as const;
    const cgv = article({ name: 'cgv', singleton: true, link });
    // Même faute que la précédente, vue de l'autre côté : le mode de lien contredit la
    // cardinalité. Deux phrases distinctes la disaient, un seul prédicat la produit.
    expect(incoherentLinks(registryOf(cgv))).toEqual([{ path: 'cgv', reason: 'link_cardinality' }]);
  });

  test('refuse un href qui cite un champ non déclaré', () => {
    const link = { mode: 'href', field: 'lien' } as const;
    expect(incoherentLinks(registryOf(article({ link })))).toEqual([
      { path: 'article.lien', reason: 'link_unknown_field' },
    ]);
  });

  test("refuse un href sur un champ qui ne peut pas porter d'URL", () => {
    const link = { mode: 'href', field: 'page' } as const;
    expect(incoherentLinks(registryOf(article({ link })))).toEqual([
      { path: 'article.page', reason: 'link_field_type' },
    ]);
  });

  test("refuse une ancre dont le parent n'est pas un ref", () => {
    const link = { mode: 'anchor', parent: 'titre' } as const;
    expect(incoherentLinks(registryOf(article({ link })))).toEqual([
      { path: 'article.titre', reason: 'link_field_type' },
    ]);
  });

  test('accepte une ancre vers un champ ref', () => {
    const link = { mode: 'anchor', parent: 'page' } as const;
    expect(incoherentLinks(registryOf(article({ link })))).toEqual([]);
  });

  test('rend TOUTES les fautes, pour dire où corriger plutôt que « registre invalide »', () => {
    const premier = article({ link: { mode: 'href', field: 'absent' } });
    const second = article({ name: 'note', link: { mode: 'anchor', parent: 'titre' } });

    expect(incoherentLinks(registryOf(premier, second))).toHaveLength(2);
  });
});
