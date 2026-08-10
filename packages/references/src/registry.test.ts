import { describe, expect, test } from 'bun:test';
import { createReferenceRegistry, linkUrl, type ReferenceTarget, storageOf } from './registry';

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

// Où vit la cible (ADR-0045). Ce qui compte ici n'est pas la carte rendue — elle est triviale —
// c'est que le SILENCE d'une cible soit un état normal : elle disparaît de la carte, et le champ
// qui la vise gardera un `uuid` nu au lieu de faire échouer un push.
describe('stockage déclaré', () => {
  const stored = (name: string, table: string): ReferenceTarget => ({
    ...target(name, route(`/${name}/:slug`)),
    storage: { table },
  });

  test('rend la table des cibles qui la déclarent', () => {
    const registry = createReferenceRegistry();
    registry.register(stored('page', 'page'));
    registry.register(stored('product', 'product'));

    expect(storageOf(registry)).toEqual({ page: 'page', product: 'product' });
  });

  test("omet la cible qui se tait, plutôt que d'inventer sa table", () => {
    const registry = createReferenceRegistry();
    registry.register(stored('page', 'page'));
    // Adossée à une vue, à un système externe, à rien de nommable : légitime, et silencieuse.
    registry.register(target('externe', route('/externe/:slug')));

    expect(storageOf(registry)).toEqual({ page: 'page' });
  });

  test('rend une carte vide quand aucune cible ne dit où elle vit', () => {
    const registry = createReferenceRegistry();
    registry.register(target('page', route('/:slug')));

    expect(storageOf(registry)).toEqual({});
  });

  test("ne dépend pas du nom de la cible : la table peut s'appeler autrement", () => {
    const registry = createReferenceRegistry();
    registry.register(stored('article', 'entity_billet'));

    expect(storageOf(registry)).toEqual({ article: 'entity_billet' });
  });
});
