import { describe, expect, it } from 'bun:test';
import { createReferenceRegistry, type ReferenceTarget } from '@repo/references';
import type { MenuItemInput } from './model';
import { resolveMenuItems, unknownTargets } from './service';

// Deux parcours récursifs de profondeur illimitée, sans aucun filet jusqu'ici. Le contrat qu'ils
// tiennent est écrit dans leurs docstrings — une cible retirée rend un lien dangling plutôt que de
// faire échouer la lecture — et rien ne le vérifiait.

const target = (name: string, rows: Record<string, string> = {}): ReferenceTarget => ({
  name,
  label: name,
  link: { mode: 'route', route: `/${name}/:slug` },
  project: async (ids) =>
    ids.filter((id) => rows[id]).map((id) => ({ id, slug: rows[id], name: rows[id] })),
  search: async () => [],
});

const item = (label: string, link: MenuItemInput['link'], children: MenuItemInput[] = []) => ({
  label,
  link,
  children,
});

const url = (value: string) => ({ target: 'url', value }) as const;

describe('cibles inconnues d’un arbre de menu', () => {
  it('ne dit rien quand tout est inscrit', () => {
    const registry = createReferenceRegistry();
    registry.register(target('product'));

    const items = [item('Mug', { target: 'product', value: 'id-1' }), item('Blog', url('/blog'))];

    expect(unknownTargets(items, registry)).toEqual([]);
  });

  it('ne considère jamais `url` comme une cible à inscrire', () => {
    expect(unknownTargets([item('Blog', url('/blog'))], createReferenceRegistry())).toEqual([]);
  });

  it('descend dans les enfants, à toute profondeur', () => {
    const registry = createReferenceRegistry();

    const items = [
      item('Racine', url('/'), [
        item('Niveau 2', url('/x'), [item('Niveau 3', { target: 'article', value: 'id-1' })]),
      ]),
    ];

    expect(unknownTargets(items, registry)).toEqual(['article']);
  });

  it('déduplique : c’est la cible qui est fautive, pas chaque occurrence', () => {
    const items = [
      item('A', { target: 'article', value: 'id-1' }),
      item('B', { target: 'article', value: 'id-2' }, [
        item('C', { target: 'article', value: 'id-3' }),
      ]),
    ];

    expect(unknownTargets(items, createReferenceRegistry())).toEqual(['article']);
  });
});

describe('résolution d’un arbre de menu', () => {
  it('laisse passer un lien URL tel quel', async () => {
    const [resolved] = await resolveMenuItems(
      [item('Blog', { target: 'url', value: '/blog', newTab: true })],
      createReferenceRegistry(),
    );

    expect(resolved.link).toEqual({ target: 'url', url: '/blog', newTab: true });
  });

  it('remplace un lien d’entité par sa projection', async () => {
    const registry = createReferenceRegistry();
    registry.register(target('product', { 'id-1': 'mug-bleu' }));

    const [resolved] = await resolveMenuItems(
      [item('Mug', { target: 'product', value: 'id-1' })],
      registry,
    );

    expect(resolved.link).toEqual({
      target: 'product',
      entity: { id: 'id-1', slug: 'mug-bleu', name: 'mug-bleu' },
      newTab: undefined,
    });
  });

  // Le contrat de robustesse, énoncé dans la docstring : la lecture ne casse jamais.
  it('rend un lien dangling quand l’entité a disparu', async () => {
    const registry = createReferenceRegistry();
    registry.register(target('product', {}));

    const [resolved] = await resolveMenuItems(
      [item('Mug', { target: 'product', value: 'id-supprime' })],
      registry,
    );

    expect(resolved.link).toEqual({ target: 'product', entity: null, newTab: undefined });
  });

  it('rend un lien dangling quand la CIBLE a été retirée du registre', async () => {
    // Un menu écrit avant qu'une entité soit retirée reste lisible — c'est ce qui distingue ce
    // chemin d'une erreur.
    const [resolved] = await resolveMenuItems(
      [item('Article', { target: 'article', value: 'id-1' })],
      createReferenceRegistry(),
    );

    expect(resolved.link).toEqual({ target: 'article', entity: null, newTab: undefined });
  });

  it('préserve la structure et l’ordre de l’arbre', async () => {
    const registry = createReferenceRegistry();
    registry.register(target('product', { 'id-1': 'mug' }));

    const resolved = await resolveMenuItems(
      [
        item('Boutique', url('/boutique'), [
          item('Mug', { target: 'product', value: 'id-1' }),
          item('Autre', url('/autre')),
        ]),
        item('Contact', url('/contact')),
      ],
      registry,
    );

    expect(resolved.map((node) => node.label)).toEqual(['Boutique', 'Contact']);
    expect(resolved[0].children.map((node) => node.label)).toEqual(['Mug', 'Autre']);
    expect(resolved[0].children[0].link).toMatchObject({ target: 'product' });
  });

  it('ne fait qu’une projection par cible, quel que soit le nombre de liens', async () => {
    let calls = 0;
    const registry = createReferenceRegistry();
    registry.register({
      name: 'product',
      label: 'product',
      link: { mode: 'route', route: '/p/:slug' },
      project: async (ids) => {
        calls += 1;
        return ids.map((id) => ({ id, slug: id, name: id }));
      },
      search: async () => [],
    });

    await resolveMenuItems(
      [
        item('A', { target: 'product', value: 'id-1' }),
        item('B', { target: 'product', value: 'id-2' }, [
          item('C', { target: 'product', value: 'id-3' }),
        ]),
      ],
      registry,
    );

    expect(calls).toBe(1);
  });
});
