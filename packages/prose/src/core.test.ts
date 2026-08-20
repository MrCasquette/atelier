import { describe, expect, test } from 'bun:test';

import { CORE_DIRECTIVES, describeIssue, proseIssues } from './core';
import { parseProse } from './parse';

const issuesOf = (source: string) => proseIssues(parseProse(source));

describe('le noyau', () => {
  test("n'admet que des enveloppes en V1", () => {
    // La contrainte qui garde le sérialiseur purement générique : aucun `leaf` au noyau, donc aucune
    // directive dont le rendu exige de connaître la structure.
    const shapes = Object.values(CORE_DIRECTIVES).map((spec) => spec.shape);

    expect(shapes).not.toContain('leaf');
    expect(new Set(shapes)).toEqual(new Set(['container', 'inline']));
  });

  test('un seul attribut dans tout le noyau', () => {
    const attributes = Object.entries(CORE_DIRECTIVES).flatMap(([name, spec]) =>
      Object.keys(spec.attributes).map((attribute) => `${name}.${attribute}`),
    );

    expect(attributes).toEqual(['quote.author']);
  });
});

describe('proseIssues — on ne valide que ce qu\'on garantit', () => {
  test('une directive du noyau bien formée ne dit rien', () => {
    expect(issuesOf(':::warning\nAttention.\n:::')).toEqual([]);
    expect(issuesOf(':::quote{author="Hugo"}\nTexte.\n:::')).toEqual([]);
  });

  test('une directive INCONNUE ne produit aucun constat (ADR-0061 §4)', () => {
    // Elle voyage structurée et sans garantie. La refuser ferait de la V1 une offre plus pauvre que
    // le HTML, et le choix de Markdown ne se défendrait plus.
    expect(issuesOf(':::machin{couleur=or}\nDu contenu.\n:::')).toEqual([]);
  });

  test('la mauvaise forme est signalée', () => {
    expect(issuesOf(':::highlight\nDu texte.\n:::')).toEqual([
      { kind: 'wrong_shape', directive: 'highlight', expected: 'inline', found: 'container' },
    ]);
  });

  test('un attribut inconnu sur une directive du noyau est signalé', () => {
    // Sur une directive garantie, c'est presque toujours une faute de frappe.
    expect(issuesOf(':::quote{auteur="Hugo"}\nTexte.\n:::')).toEqual([
      { kind: 'unknown_attribute', directive: 'quote', attribute: 'auteur' },
    ]);
  });

  test('une classe sur une directive du noyau est signalée comme attribut inconnu', () => {
    expect(issuesOf(':::warning{.text-red-500}\nTexte.\n:::')).toEqual([
      { kind: 'unknown_attribute', directive: 'warning', attribute: 'class' },
    ]);
  });

  test('les directives imbriquées sont toutes examinées', () => {
    const issues = issuesOf(':::warning\n:::quote{auteur=x}\nTexte.\n::::\n:::');

    expect(issues.map((issue) => issue.directive)).toContain('quote');
  });

  test('un registre peut remplacer le noyau — le paquet ne présume de rien', () => {
    const issues = proseIssues(parseProse(':::maison\nTexte.\n:::'), {
      maison: { shape: 'inline', attributes: {} },
    });

    expect(issues).toEqual([
      { kind: 'wrong_shape', directive: 'maison', expected: 'inline', found: 'container' },
    ]);
  });
});

describe('describeIssue', () => {
  test('rend un constat lisible', () => {
    expect(
      describeIssue({ kind: 'missing_attribute', directive: 'figure', attribute: 'src' }),
    ).toBe('« figure » exige l\'attribut « src ».');
    expect(
      describeIssue({ kind: 'wrong_shape', directive: 'highlight', expected: 'inline', found: 'container' }),
    ).toBe('« highlight » s\'écrit en inline, pas en container.');
  });
});
