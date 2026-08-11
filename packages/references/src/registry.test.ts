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

  // `href` et `anchor` (ADR-0046) : la cible a calculé l'URL en projetant, `linkUrl` la rend. Le
  // socle n'a pas à savoir lire un champ ni joindre une table parente — `project()` est déjà
  // l'endroit où l'on interroge la base.
  test("rend l'URL que la cible a projetée, pour les modes qui demandent de la donnée", () => {
    const social = target('social', { mode: 'href', field: 'url' });
    const anchor = target('section', { mode: 'anchor', parent: 'page' });

    expect(linkUrl(social, { id: 'x', slug: 's', name: 'n', url: 'https://exemple.fr' })).toBe(
      'https://exemple.fr',
    );
    expect(linkUrl(anchor, { id: 'x', slug: 'tarifs', name: 'n', url: '/a-propos#tarifs' })).toBe(
      '/a-propos#tarifs',
    );
  });

  test("rend null quand l'occurrence n'a pas d'URL — champ vide, parent supprimé", () => {
    // `null` ne dit plus « mode non implémenté » : il dit que CETTE occurrence n'est pas liable.
    const social = target('social', { mode: 'href', field: 'url' });

    expect(linkUrl(social, { id: 'x', slug: 's', name: 'n' })).toBeNull();
    expect(linkUrl(social, { id: 'x', slug: 's', name: 'n', url: null })).toBeNull();
  });

  test("ignore l'URL projetée en mode route : la déclaration suffit", () => {
    // Une cible `route` n'a aucune raison d'en calculer une, et si elle le faisait, c'est la route
    // déclarée qui fait foi — sans quoi deux sources diraient l'URL d'une même entité.
    const product = target('product', route('/produits/:slug'));

    expect(linkUrl(product, { id: 'x', slug: 'mug', name: 'Mug', url: '/ailleurs' })).toBe(
      '/produits/mug',
    );
  });

  test('retire une cible inscrite, et le dit', () => {
    // Les entités s'inscrivent depuis le journal : un push peut en retirer une (ADR-0046).
    const registry = createReferenceRegistry();
    registry.register(target('entity:article', route('/blog/:slug')));

    expect(registry.unregister('entity:article')).toBe(true);
    expect(registry.has('entity:article')).toBe(false);
    expect(registry.unregister('entity:article')).toBe(false);
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
