import { describe, expect, it } from 'bun:test';
import {
  emailLayout,
  hasEmailTemplate,
  listEmailTemplates,
  registerEmailTemplate,
  renderTemplate,
} from './templates';

// La seule surface de ce paquet qui se teste sans effet externe. L'envoi lui-même n'a pas de
// couture : `sendEmail` résout son adapter via un singleton de module, donc rien ne permet de lui
// en substituer un faux. Tant que ce n'est pas traité, un test de `sendEmail` ne pourrait être
// « sûr » que par l'absence de configuration en base — une propriété de la donnée, pas du code.
//
// `templates` est un registre GLOBAL, prérempli par le module lui-même : chaque test inscrit un nom
// qui lui est propre pour ne pas interférer avec les gabarits du socle ni avec ses voisins.

describe('registre de gabarits', () => {
  it('inscrit un gabarit et le rend', () => {
    registerEmailTemplate('test-simple', (data) => `Bonjour ${data.nom}`);

    expect(hasEmailTemplate('test-simple')).toBe(true);
    expect(renderTemplate('test-simple', { nom: 'Ada' })).toBe('Bonjour Ada');
  });

  it('ignore ce qui n’a pas été inscrit — le type ouvert ne peut plus le dire', () => {
    // `EmailTemplate` est un `string` (registre ouvert) : la vérification ne peut plus être
    // statique, elle est reportée ici, à l'exécution.
    expect(hasEmailTemplate('jamais-inscrit')).toBe(false);
    expect(() => renderTemplate('jamais-inscrit', {})).toThrow(/Unknown email template/);
  });

  it('remplace un gabarit réinscrit sous le même nom', () => {
    registerEmailTemplate('test-remplace', () => 'premier');
    registerEmailTemplate('test-remplace', () => 'second');

    expect(renderTemplate('test-remplace', {})).toBe('second');
  });

  it('liste les gabarits du socle, qui sont ceux qu’il possède réellement', () => {
    // Le socle n'inscrit que ce qui ne dépend pas de la nature du produit. Commande, expédition et
    // bienvenue sont inscrits par Échoppe, dans son propre module.
    const listed = listEmailTemplates();

    expect(listed).toContain('contact-form');
    expect(listed).not.toContain('order-confirmation');
  });
});

describe('enveloppe HTML commune', () => {
  it('porte le titre et le contenu du gabarit', () => {
    const html = emailLayout({ title: 'Bienvenue', content: '<p>Salut</p>' });

    expect(html).toContain('<h1>Bienvenue</h1>');
    expect(html).toContain('<p>Salut</p>');
  });

  it('omet le pied de page quand il n’est pas fourni', () => {
    // Les e-mails internes — formulaire de contact — n'en ont pas.
    const avec = emailLayout({ title: 'T', content: 'C', footer: 'Ma boutique' });
    const sans = emailLayout({ title: 'T', content: 'C' });

    expect(avec).toContain('Ma boutique');
    expect(sans).not.toContain('class="footer"');
  });

  it('ajoute les styles du gabarit au socle commun, sans le remplacer', () => {
    const html = emailLayout({
      title: 'T',
      content: 'C',
      extraStyles: '.message { color: red; }',
    });

    expect(html).toContain('.container');
    expect(html).toContain('.message { color: red; }');
  });
});
