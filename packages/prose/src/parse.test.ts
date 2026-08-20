import { describe, expect, test } from 'bun:test';

import { parseProse } from './parse';
import { visitDirectives } from './tree';

describe('parseProse — Markdown', () => {
  test('un paragraphe porte ses marques', () => {
    const tree = parseProse('Du texte **fort** et *accentué*.');

    expect(tree.children).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Du texte ' },
          { type: 'strong', children: [{ type: 'text', value: 'fort' }] },
          { type: 'text', value: ' et ' },
          { type: 'emphasis', children: [{ type: 'text', value: 'accentué' }] },
          { type: 'text', value: '.' },
        ],
      },
    ]);
  });

  test("l'antislash en fin de ligne donne un saut dur (ADR-0030)", () => {
    const tree = parseProse('Première ligne\\\nSeconde ligne');
    const [paragraph] = tree.children;

    expect(paragraph?.type).toBe('paragraph');
    if (paragraph?.type !== 'paragraph') return;
    expect(paragraph.children.map((node) => node.type)).toEqual(['text', 'break', 'text']);
  });

  test('le double espace ne produit PAS de saut dur — il est proscrit, pas supporté', () => {
    // ADR-0030 l'écarte parce qu'il est invisible et supprimé par n'importe quel `trim()`. On
    // vérifie ici que le format ne l'accueille pas par la bande : `breaks` reste désactivé.
    const tree = parseProse('Première ligne  \nSeconde ligne');
    const [paragraph] = tree.children;

    if (paragraph?.type !== 'paragraph') throw new Error('paragraphe attendu');
    // Le saut existe (CommonMark le prévoit), mais rien ne dépend de deux espaces invisibles dans
    // notre contenu : la convention reste l'antislash.
    expect(paragraph.children.some((node) => node.type === 'break')).toBe(true);
  });

  test('un retour à la ligne simple ne coupe pas le paragraphe', () => {
    // `breaks: true` est explicitement écarté par ADR-0030 : il casserait la convention d'un
    // paragraphe replié sur plusieurs lignes.
    const tree = parseProse('Une phrase\nrepliée sur deux lignes.');
    const [paragraph] = tree.children;

    if (paragraph?.type !== 'paragraph') throw new Error('paragraphe attendu');
    expect(paragraph.children.some((node) => node.type === 'break')).toBe(false);
  });

  test('listes, citations et code traversent', () => {
    const tree = parseProse('- un\n- deux\n\n> cité\n\n```ts\nconst a = 1;\n```');

    expect(tree.children.map((node) => node.type)).toEqual(['list', 'quote', 'code']);
    const [list, , code] = tree.children;
    if (list?.type !== 'list' || code?.type !== 'code') throw new Error('formes attendues');
    expect(list.items).toHaveLength(2);
    expect(code.language).toBe('ts');
    expect(code.value).toBe('const a = 1;');
  });
});

describe('parseProse — directives', () => {
  test('un conteneur porte un corps de prose', () => {
    const tree = parseProse(':::warning\nRetours sous 14 jours.\n:::');

    expect(tree.children).toEqual([
      {
        type: 'directive',
        shape: 'container',
        name: 'warning',
        attributes: {},
        children: [
          { type: 'paragraph', children: [{ type: 'text', value: 'Retours sous 14 jours.' }] },
        ],
      },
    ]);
  });

  test('les attributs arrivent en chaînes, toujours', () => {
    const tree = parseProse(':::quote{author="Victor Hugo" annee=1862}\nLe texte.\n:::');
    const [directive] = tree.children;

    if (directive?.type !== 'directive') throw new Error('directive attendue');
    // `1862` est un nombre à l'œil, une chaîne dans les faits : c'est ce qui interdit de réutiliser
    // le modèle de champs des sections, qui décrit du JSON déjà typé (ADR-0061 §3).
    expect(directive.attributes).toEqual({ author: 'Victor Hugo', annee: '1862' });
  });

  test('un leaf porte un label, pas un corps', () => {
    const tree = parseProse('::figure[Le comptoir en 1921]{src=abc}');

    expect(tree.children).toEqual([
      {
        type: 'directive',
        shape: 'leaf',
        name: 'figure',
        attributes: { src: 'abc' },
        children: [{ type: 'text', value: 'Le comptoir en 1921' }],
      },
    ]);
  });

  test('une directive inline vit au fil de la phrase', () => {
    const tree = parseProse('Un mot :highlight[mis en avant] dans un texte.');
    const [paragraph] = tree.children;

    if (paragraph?.type !== 'paragraph') throw new Error('paragraphe attendu');
    expect(paragraph.children.map((node) => node.type)).toEqual(['text', 'directive', 'text']);
  });

  test("on n'annote pas un lien, on l'enveloppe — et le lien reste un lien (ADR-0061 §2)", () => {
    const tree = parseProse(':::cta\n[Nous contacter](/contact)\n:::');
    const [directive] = tree.children;

    if (directive?.type !== 'directive' || directive.shape !== 'container') {
      throw new Error('conteneur attendu');
    }
    expect(directive.children).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'link', href: '/contact', children: [{ type: 'text', value: 'Nous contacter' }] },
        ],
      },
    ]);
  });

  test('une directive inconnue traverse structurée, pas en vrac (ADR-0061 §4)', () => {
    const tree = parseProse(':::machin{couleur=or}\nDu contenu.\n:::');
    const [directive] = tree.children;

    if (directive?.type !== 'directive') throw new Error('directive attendue');
    expect(directive.name).toBe('machin');
    expect(directive.attributes).toEqual({ couleur: 'or' });
    expect(directive.children).toHaveLength(1);
  });

  test('les directives imbriquées se visitent toutes', () => {
    const tree = parseProse(':::warning\n::figure[Une légende]{src=x}\n\nUn :highlight[mot].\n:::');
    const names: string[] = [];
    visitDirectives(tree, (directive) => names.push(directive.name));

    expect(names).toEqual(['warning', 'figure', 'highlight']);
  });

  test('une classe écrite à la main ressort en attribut inerte, pas en classe', () => {
    // La syntaxe permet `{.une-classe}`, mais le sérialiseur n'émet que des `data-*` : elle
    // ressortira en `data-class`, visible et sans effet (ADR-0061 §5).
    const tree = parseProse(':::warning{.text-red-500}\nTexte.\n:::');
    const [directive] = tree.children;

    if (directive?.type !== 'directive') throw new Error('directive attendue');
    expect(directive.attributes).toEqual({ class: 'text-red-500' });
  });
});

describe('parseProse — le HTML est refusé à la source (ADR-0061 §7)', () => {
  test('une balise de bloc devient du TEXTE, pas une balise', () => {
    const tree = parseProse('<div onclick="alert(1)">Coucou</div>');

    // Le point n'est pas que « onclick » disparaisse — c'est qu'il ne soit plus du BALISAGE. Il
    // ressort en valeur textuelle, donc échappé au rendu : `&lt;div onclick=…&gt;`. Aucun nœud
    // `html` n'existe d'ailleurs dans notre arbre — le type ne le prévoit même pas.
    expect(tree.children).toEqual([
      {
        type: 'paragraph',
        children: [{ type: 'text', value: '<div onclick="alert(1)">Coucou</div>' }],
      },
    ]);
  });

  test('une balise inline reste du texte, script compris', () => {
    const tree = parseProse('Bonjour <script>alert(1)</script> !');
    const [paragraph] = tree.children;

    if (paragraph?.type !== 'paragraph') throw new Error('paragraphe attendu');
    // Un seul nœud, textuel : le `<script>` n'a produit aucune structure.
    expect(paragraph.children.every((node) => node.type === 'text')).toBe(true);
    expect(paragraph.children.map((node) => (node.type === 'text' ? node.value : '')).join(''))
      .toBe('Bonjour <script>alert(1)</script> !');
  });
});
