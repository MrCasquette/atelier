import { describe, expect, test } from 'bun:test';

import { proseToHtml, safeUrl } from './html.js';
import { parseProse } from './parse.js';

const render = (source: string): string => proseToHtml(parseProse(source));

describe('proseToHtml — rendu', () => {
  test('les marques Markdown deviennent leurs balises', () => {
    expect(render('Du **fort** et de l*accent*.')).toBe(
      '<p>Du <strong>fort</strong> et de l<em>accent</em>.</p>',
    );
  });

  test('une directive conteneur devient un div à data-attributs', () => {
    expect(render(':::warning\nAttention.\n:::')).toBe(
      '<div data-directive="warning"><p>Attention.</p></div>',
    );
  });

  test('une directive inline devient un span', () => {
    expect(render('Un :highlight[mot] ici.')).toBe(
      '<p>Un <span data-directive="highlight">mot</span> ici.</p>',
    );
  });

  test('les attributs sortent en data-*, jamais en class', () => {
    const html = render(':::quote{author="Victor Hugo"}\nLe texte.\n:::');

    expect(html).toBe(
      '<div data-directive="quote" data-author="Victor Hugo"><p>Le texte.</p></div>',
    );
    expect(html).not.toContain('class=');
  });

  test('une classe écrite dans le contenu ressort inerte', () => {
    // `{.text-red-500}` est syntaxiquement possible. Elle sort en `data-class` : visible, et sans
    // aucun effet puisque Tailwind ne scanne pas la base (ADR-0061 §5).
    expect(render(':::warning{.text-red-500}\nTexte.\n:::')).toBe(
      '<div data-directive="warning" data-class="text-red-500"><p>Texte.</p></div>',
    );
  });

  test('figure enveloppe une vraie image Markdown et sa légende', () => {
    // Le cas qui a fait préférer l'enveloppe au `leaf` : l'image reste un `![alt](src)` standard.
    expect(render(':::figure\n![Le comptoir](/media/abc.jpg)\n\nLe comptoir en 1921\n:::')).toBe(
      '<div data-directive="figure">' +
        '<p><img src="/media/abc.jpg" alt="Le comptoir" /></p>' +
        '<p>Le comptoir en 1921</p>' +
        '</div>',
    );
  });

  test('cta enveloppe un lien qui reste un lien', () => {
    expect(render(':::cta\n[Nous contacter](/contact)\n:::')).toBe(
      '<div data-directive="cta"><p><a href="/contact">Nous contacter</a></p></div>',
    );
  });

  test('un bloc de code porte data-language, pas une classe', () => {
    expect(render('```ts\nconst a = 1;\n```')).toBe(
      '<pre><code data-language="ts">const a = 1;</code></pre>',
    );
  });
});

describe('proseToHtml — échappement', () => {
  test('le texte est échappé', () => {
    expect(render('5 < 6 & "sept"')).toBe('<p>5 &lt; 6 &amp; &quot;sept&quot;</p>');
  });

  test('une balise écrite dans le contenu ressort échappée, jamais exécutée', () => {
    const html = render('<script>alert(1)</script>');

    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  test("la valeur d'un attribut est échappée", () => {
    const html = render(':::quote{author="a\\" onload=\\"x"}\nTexte.\n:::');

    expect(html).not.toContain('onload="x"');
    expect(html).toContain('&quot;');
  });

  test("un nom d'attribut hostile est ignoré, pas émis", () => {
    // Sans ce filtre, un nom contenant un guillemet briserait la balise — le préfixe `data-` n'y
    // suffirait pas, c'est le NOM qui doit être inerte.
    const html = render(':::warning{OnClick=x}\nTexte.\n:::');

    expect(html).toBe('<div data-directive="warning"><p>Texte.</p></div>');
  });
});

describe('safeUrl — une URL est un vecteur à part entière', () => {
  test('les schémas sûrs passent', () => {
    expect(safeUrl('https://exemple.fr')).toBe('https://exemple.fr');
    expect(safeUrl('mailto:a@b.fr')).toBe('mailto:a@b.fr');
    expect(safeUrl('tel:+33100000000')).toBe('tel:+33100000000');
  });

  test('les URL relatives passent — le cas courant du lien interne', () => {
    expect(safeUrl('/contact')).toBe('/contact');
    expect(safeUrl('#ancre')).toBe('#ancre');
    expect(safeUrl('./page')).toBe('./page');
  });

  test('javascript: est refusé', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
  });

  test('la casse ne masque pas le schéma', () => {
    expect(safeUrl('JaVaScRiPt:alert(1)')).toBeNull();
  });

  test('les caractères de contrôle ne masquent pas le schéma', () => {
    expect(safeUrl('java\tscript:alert(1)')).toBeNull();
    expect(safeUrl('  javascript:alert(1)')).toBeNull();
    expect(safeUrl('java\nscript:alert(1)')).toBeNull();
  });

  test('data: est refusé — data:text/html vaut exécution', () => {
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  test('un lien refusé perd son href et reste inerte', () => {
    // Pas de repli vers `#` : la dégradation doit être visible, pas silencieusement redirigée.
    expect(render('[clic](javascript:alert(1))')).toBe('<p><a>clic</a></p>');
  });
});
