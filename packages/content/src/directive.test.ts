import { describe, expect, test } from 'bun:test';
import { CORE_DIRECTIVES, parseProse, proseIssues } from '@axiome-apps/atelier-prose';
import { defineContent, defineDirective, defineSection, directiveRegistry } from './define.js';
import { field as f } from './field.js';
import { serialize } from './serialize.js';

describe('defineDirective', () => {
  test('déclare une forme et ses attributs', () => {
    expect(defineDirective('video', { shape: 'leaf', attributes: { id: { required: true } } })).toEqual(
      { kind: 'directive', name: 'video', shape: 'leaf', attributes: { id: { required: true } } },
    );
  });

  test('les attributs sont facultatifs à la déclaration', () => {
    expect(defineDirective('encart', { shape: 'container' }).attributes).toEqual({});
  });

  test('refuse un nom que le parseur ne saurait pas lire', () => {
    expect(() => defineDirective('Mon Encart', { shape: 'container' })).toThrow(/nom de directive/);
    expect(() => defineDirective('mon.encart', { shape: 'container' })).toThrow(/nom de directive/);
    expect(() => defineDirective('mon-encart', { shape: 'container' })).not.toThrow();
  });

  // La fermeture du noyau (ADR-0061 §4) rendue exécutoire : la collision devient impossible plutôt
  // qu'improbable, et le dev l'apprend en écrivant sa déclaration.
  test('refuse de redéfinir une directive du noyau', () => {
    for (const name of Object.keys(CORE_DIRECTIVES)) {
      expect(() => defineDirective(name, { shape: 'container' })).toThrow(/noyau/);
    }
  });
});

describe('defineContent', () => {
  test('accueille les directives dans leur propre champ', () => {
    const content = defineContent({
      sections: [defineSection('article', { fields: { corps: f.richText() } })],
      directives: [defineDirective('video', { shape: 'leaf' })],
    });

    expect(content.directives.map((directive) => directive.name)).toEqual(['video']);
  });

  test('sans directives déclarées, le champ existe et il est vide', () => {
    const content = defineContent({
      sections: [defineSection('article', { fields: { corps: f.richText() } })],
    });

    expect(content.directives).toEqual([]);
  });

  test('refuse deux directives du même nom', () => {
    expect(() =>
      defineContent({
        sections: [defineSection('article', { fields: { corps: f.richText() } })],
        directives: [
          defineDirective('encart', { shape: 'container' }),
          defineDirective('encart', { shape: 'inline' }),
        ],
      }),
    ).toThrow(/deux fois/);
  });

  // ADR-0061 §3 : « Rien ne va en base. » Ce test garde le FAIT, pas l'intention — un registre qui
  // se mettrait à porter les directives le ferait tomber.
  test('une directive ne part pas au registre', () => {
    const registry = serialize(
      defineContent({
        sections: [defineSection('article', { fields: { corps: f.richText() } })],
        directives: [defineDirective('video', { shape: 'leaf', attributes: { id: {} } })],
      }),
    );

    expect(JSON.stringify(registry)).not.toContain('video');
    expect(Object.keys(registry)).toEqual(['version', 'sections', 'components']);
  });
});

describe('directiveRegistry', () => {
  test('le noyau y est, même sans rien déclarer', () => {
    const content = defineContent({
      sections: [defineSection('article', { fields: { corps: f.richText() } })],
    });

    expect(Object.keys(directiveRegistry(content)).sort()).toEqual(
      Object.keys(CORE_DIRECTIVES).sort(),
    );
  });

  // Le piège que ce helper existe pour éviter : passer ses seules directives à `proseIssues` perd
  // la validation du noyau, sans que rien ne le signale.
  test('valide le noyau ET les directives du dev', () => {
    const content = defineContent({
      sections: [defineSection('article', { fields: { corps: f.richText() } })],
      directives: [defineDirective('encart', { shape: 'container', attributes: { ton: {} } })],
    });

    const registry = directiveRegistry(content);
    const tree = parseProse(':::warning{foo=1}\nAttention.\n:::\n\n:::encart{bar=2}\nTexte.\n:::');
    const issues = proseIssues(tree, registry).map((issue) => issue.directive).sort();

    expect(issues).toEqual(['encart', 'warning']);
  });

  test('une directive non déclarée traverse toujours sans constat', () => {
    const content = defineContent({
      sections: [defineSection('article', { fields: { corps: f.richText() } })],
    });

    const tree = parseProse(':::inconnue{quoi=1}\nTexte.\n:::');
    expect(proseIssues(tree, directiveRegistry(content))).toEqual([]);
  });
});
