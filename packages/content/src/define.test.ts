import { describe, expect, test } from 'bun:test';
import { defineComponent, defineContent, defineEntity, defineSection } from './define.js';
import { field as f } from './field.js';
import { serialize } from './serialize.js';
import type { InferEntity } from './types.js';

// Une entité est de la DONNÉE, pas de la présentation (ADR-0026) : elle partage la grammaire de
// champs avec les sections, et rien d'autre — ni le stockage, ni l'espace de noms.

describe('defineEntity', () => {
  test("borne le nom à ce qu'une table peut porter", () => {
    // Le nom devient un identifiant SQL (ADR-0027). On refuse plutôt que d'échapper : échapper une
    // chaîne libre, c'est accepter n'importe quoi et espérer bien s'en tirer.
    expect(() => defineEntity('Article', { fields: {} })).toThrow(/nom d'entité valide/);
    expect(() => defineEntity('mon-article', { fields: {} })).toThrow(/nom d'entité valide/);
    expect(() => defineEntity('a"; drop table page; --', { fields: {} })).toThrow(
      /nom d'entité valide/,
    );
    expect(() => defineEntity('article_2', { fields: {} })).not.toThrow();
  });

  test("refuse une section là où une entité est attendue, et l'inverse", () => {
    const hero = defineSection('hero', { fields: { titre: f.text() } });
    const article = defineEntity('article', { fields: { titre: f.text() } });

    // @ts-expect-error une entité n'est pas insérable en page
    expect(() => defineContent({ sections: [article] })).toThrow(/pas une section/);
    // @ts-expect-error une section n'est pas de la donnée
    expect(() => defineContent({ sections: [], entities: [hero] })).toThrow(/pas une entité/);
  });
});

describe('sérialisation des entités', () => {
  test('normalise `singleton`, que l’authoring laisse optionnel', () => {
    const registry = serialize(
      defineContent({
        sections: [],
        entities: [
          defineEntity('article', { label: 'Articles', fields: { titre: f.text() } }),
          defineEntity('cgv', { singleton: true, fields: { corps: f.richText() } }),
        ],
      }),
    );

    expect(registry.entities?.article).toMatchObject({
      name: 'article',
      label: 'Articles',
      singleton: false,
    });
    expect(registry.entities?.cgv.singleton).toBe(true);
  });

  test('auto-collecte les components cités par une entité, comme pour une section', () => {
    const auteur = defineComponent('auteur', { fields: { nom: f.text({ required: true }) } });

    const registry = serialize(
      defineContent({
        sections: [],
        entities: [defineEntity('article', { fields: { auteurs: f.list(auteur) } })],
      }),
    );

    expect(registry.components.auteur).toBeDefined();
    expect(registry.entities?.article.fields.auteurs).toEqual({ kind: 'list', of: 'auteur' });
  });

  test('refuse deux entités de même nom', () => {
    const content = defineContent({
      sections: [],
      entities: [
        defineEntity('article', { fields: { titre: f.text() } }),
        defineEntity('article', { fields: { autre: f.text() } }),
      ],
    });

    expect(() => serialize(content)).toThrow(/Collision de nom/);
  });

  test("un nom d'entité peut coïncider avec un nom de section : espaces distincts", () => {
    // Question laissée ouverte par ADR-0026. Sections et components partagent une table, donc un
    // espace de noms ; une entité a sa propre table dérivée. Les forcer à s'exclure serait une
    // contrainte inventée.
    const registry = serialize(
      defineContent({
        sections: [defineSection('article', { fields: { titre: f.text() } })],
        entities: [defineEntity('article', { fields: { corps: f.richText() } })],
      }),
    );

    expect(registry.sections.article.fields).toHaveProperty('titre');
    expect(registry.entities?.article.fields).toHaveProperty('corps');
  });

  test("un contenu sans entités pousse le JSON d'avant leur existence", () => {
    // La clé est OMISE, pas rendue vide : sinon `content:check` se dirait désynchronisé chez tout
    // le monde, sans que rien ait changé dans les fichiers du dev.
    const registry = serialize(
      defineContent({ sections: [defineSection('hero', { fields: { titre: f.text() } })] }),
    );

    expect(registry).not.toHaveProperty('entities');
    expect(Object.keys(registry)).toEqual(['version', 'sections', 'components']);
  });
});

// Le lien d'une entité (ADR-0046). Ce qui se vérifie ici, ce sont les REFUS : un lien qui cite un
// champ inexistant ne se résoudra jamais, et rien ne le dirait avant la mise en ligne.
describe('déclarer le lien dune entité', () => {
  const article = (link?: Parameters<typeof defineEntity>[1]['link']) =>
    defineEntity('article', {
      link,
      fields: { titre: f.text(), url: f.text(), page: f.ref({ to: 'page' }) },
    });

  test('inscrit le lien déclaré dans le registre poussé', () => {
    const registry = serialize(
      defineContent({
        sections: [defineSection('hero', { fields: { titre: f.text() } })],
        entities: [article({ mode: 'route', route: '/blog/:slug' })],
      }),
    );

    expect(registry.entities?.article.link).toEqual({ mode: 'route', route: '/blog/:slug' });
  });

  test("omet la clé quand l'entité ne se cite pas — le JSON d'avant ADR-0046", () => {
    // Sinon `content:check` se dirait désynchronisé chez tout le monde, sans qu'un fichier change.
    const registry = serialize(
      defineContent({
        sections: [defineSection('hero', { fields: { titre: f.text() } })],
        entities: [article()],
      }),
    );

    expect(registry.entities?.article).not.toHaveProperty('link');
  });

  test('refuse une route de liste sans slug — toutes les occurrences auraient la même URL', () => {
    expect(() => article({ mode: 'route', route: '/blog' })).toThrow(/:slug/);
  });

  test("refuse un slug sur un singleton, qui n'en a pas", () => {
    // ADR-0039 : l'identité d'un singleton est son nom.
    expect(() =>
      defineEntity('cgv', {
        singleton: true,
        link: { mode: 'route', route: '/cgv/:slug' },
        fields: { corps: f.richText() },
      }),
    ).toThrow(/singleton/);
  });

  test('accepte une route sans slug sur un singleton', () => {
    const cgv = defineEntity('cgv', {
      singleton: true,
      link: { mode: 'route', route: '/conditions-generales' },
      fields: { corps: f.richText() },
    });

    expect(cgv.link).toEqual({ mode: 'route', route: '/conditions-generales' });
  });

  test('refuse un href qui cite un champ non déclaré', () => {
    expect(() => article({ mode: 'href', field: 'lien' })).toThrow(/non déclaré|pas déclaré/);
  });

  test('refuse un href qui cite un champ incapable de porter une URL', () => {
    expect(() =>
      defineEntity('reseau', {
        link: { mode: 'href', field: 'visuel' },
        fields: { visuel: f.image() },
      }),
    ).toThrow(/texte/);
  });

  test("refuse une ancre dont le parent n'est pas un ref", () => {
    expect(() => article({ mode: 'anchor', parent: 'titre' })).toThrow(/ref/);
  });

  test('accepte une ancre vers un champ ref', () => {
    expect(article({ mode: 'anchor', parent: 'page' }).link).toEqual({
      mode: 'anchor',
      parent: 'page',
    });
  });
});

describe('inférence de la forme rendue', () => {
  test('une entité de liste porte un slug, un singleton non', () => {
    const article = defineEntity('article', {
      fields: { titre: f.text({ required: true }), vues: f.number() },
    });
    const cgv = defineEntity('cgv', { singleton: true, fields: { corps: f.richText() } });

    // La vérification est au type-check : ces valeurs ne compilent que si l'inférence est juste.
    const uneListe: InferEntity<typeof article> = { id: 'x', slug: 'mon-article', titre: 'Titre' };
    const unSingleton: InferEntity<typeof cgv> = { id: 'y' };

    expect(uneListe.slug).toBe('mon-article');
    expect(unSingleton.id).toBe('y');
  });
});
