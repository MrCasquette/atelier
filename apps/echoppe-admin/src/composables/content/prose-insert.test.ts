import { describe, expect, test } from 'bun:test';
import { parseProse, proseIssues, visitDirectives } from '@axiome-apps/atelier-prose';
import { directiveSnippet, insertDirective } from './prose-insert';

// Ce que ces tests gardent : que le bouton produise une directive que le PARSEUR reconnaît. Vérifier
// la chaîne produite ne suffirait pas — `:::warning` collé à un paragraphe est une chaîne correcte
// et une directive inexistante. On reparse donc le résultat.

/** Les noms de directives que le parseur retrouve dans un texte. */
function directivesOf(source: string): string[] {
  const found: string[] = [];
  visitDirectives(parseProse(source), (directive) => found.push(directive.name));
  return found;
}

describe('directiveSnippet', () => {
  test('enveloppe la sélection plutôt que de la remplacer', () => {
    expect(directiveSnippet('cta', 'container', '[Nous contacter](/contact)')).toBe(
      ':::cta\n[Nous contacter](/contact)\n:::',
    );
    expect(directiveSnippet('highlight', 'inline', 'ce mot')).toBe(':highlight[ce mot]');
  });

  test('fournit un texte d’exemple quand rien n’est sélectionné', () => {
    expect(directiveSnippet('warning', 'container', '')).toBe(':::warning\nVotre texte.\n:::');
    expect(directiveSnippet('highlight', 'inline', '')).toBe(':highlight[texte]');
    expect(directiveSnippet('figure', 'leaf', '')).toBe('::figure[légende]');
  });
});

describe('insertDirective', () => {
  test('sur un champ vide, produit une directive reconnue', () => {
    const { value, caret } = insertDirective('', 0, 0, 'warning', 'container');
    expect(directivesOf(value)).toEqual(['warning']);
    expect(caret).toBe(value.length);
  });

  test('isole un conteneur collé à la fin d’un paragraphe', () => {
    const source = 'Un paragraphe.';
    const { value } = insertDirective(source, source.length, source.length, 'note', 'container');

    // Sans les sauts de ligne ajoutés, le parseur ne verrait aucune directive : c'est précisément
    // ce que ce test garde.
    expect(directivesOf(value)).toEqual(['note']);
    expect(value.startsWith('Un paragraphe.\n\n:::note')).toBe(true);
  });

  test('n’ajoute pas de saut de ligne là où il y en a déjà', () => {
    const source = 'Un paragraphe.\n\n';
    const { value } = insertDirective(source, source.length, source.length, 'tip', 'container');
    expect(value).toBe('Un paragraphe.\n\n:::tip\nVotre texte.\n:::');
  });

  test('sépare le conteneur du texte qui le suit', () => {
    const source = 'Avant.\n\nAprès.';
    const { value } = insertDirective(source, 8, 8, 'warning', 'container');
    expect(directivesOf(value)).toEqual(['warning']);
    expect(value.endsWith('\nAprès.')).toBe(true);
  });

  test('une inline s’insère au fil de la phrase, sans rien couper', () => {
    const source = 'Un mot important ici.';
    const { value } = insertDirective(source, 7, 16, 'highlight', 'inline');
    expect(value).toBe('Un mot :highlight[important] ici.');
    expect(directivesOf(value)).toEqual(['highlight']);
  });

  test('ce que le bouton produit ne porte aucun constat', () => {
    // Le noyau se découvre : si une directive y entre, elle est couverte ici sans qu'on y touche.
    const shapes = [
      ['warning', 'container'],
      ['quote', 'container'],
      ['highlight', 'inline'],
    ] as const;

    for (const [name, shape] of shapes) {
      const { value } = insertDirective('', 0, 0, name, shape);
      expect(proseIssues(parseProse(value))).toEqual([]);
    }
  });

  test('le lien enveloppé reste un vrai lien Markdown', () => {
    const source = '[Nous contacter](/contact)';
    const { value } = insertDirective(source, 0, source.length, 'cta', 'container');

    const tree = parseProse(value);
    let href: string | null = null;
    visitDirectives(tree, (directive) => {
      if (directive.shape !== 'container') return;
      for (const block of directive.children) {
        if (block.type !== 'paragraph') continue;
        for (const inline of block.children) {
          if (inline.type === 'link') href = inline.href;
        }
      }
    });

    expect(href).toBe('/contact');
  });
});
