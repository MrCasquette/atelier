import { describe, expect, test } from 'bun:test';
import { createReferenceRegistry, linkUrl, type ReferenceTarget } from './registry';

const target = (name: string, link: ReferenceTarget['link']): ReferenceTarget => ({
  name,
  label: name,
  link,
  project: async () => [],
  search: async () => [],
});

const route = (path: string) => ({ mode: 'route', route: path }) as const;

describe('registre de cibles référençables', () => {
  test("rend les cibles dans l'ordre d'inscription — c'est celui du sélecteur", () => {
    const registry = createReferenceRegistry();
    registry.register(target('page', route('/:slug')));
    registry.register(target('product', route('/produits/:slug')));

    expect(registry.names()).toEqual(['page', 'product']);
  });

  test('refuse une cible déjà inscrite plutôt que de la remplacer en silence', () => {
    const registry = createReferenceRegistry();
    registry.register(target('page', route('/:slug')));

    expect(() => registry.register(target('page', route('/autre/:slug')))).toThrow(
      'Cible référençable déjà inscrite : page',
    );
  });

  test("une cible non inscrite est absente, pas invalide — le silence rend l'entité invisible", () => {
    const registry = createReferenceRegistry();

    expect(registry.has('article')).toBe(false);
    expect(registry.get('article')).toBeUndefined();
  });

  test('substitue le slug dans la route déclarée', () => {
    const product = target('product', route('/produits/:slug'));

    expect(linkUrl(product, { id: 'x', slug: 'mug-bleu', name: 'Mug bleu' })).toBe(
      '/produits/mug-bleu',
    );
  });

  test("ne produit pas d'URL pour les modes qui ne se dérivent pas d'une projection seule", () => {
    const social = target('social', { mode: 'href', field: 'url' });
    const anchor = target('section', { mode: 'anchor', parent: 'page' });
    const entity = { id: 'x', slug: 's', name: 'n' };

    expect(linkUrl(social, entity)).toBeNull();
    expect(linkUrl(anchor, entity)).toBeNull();
  });
});
