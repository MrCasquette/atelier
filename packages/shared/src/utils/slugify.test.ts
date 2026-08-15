import { describe, expect, it } from 'bun:test';
import { slugify } from './slugify';

// Quatre modules de l'API en dérivent des URL publiques (produit, collection, catégorie, tag). Une
// régression ici change des adresses déjà servies et déjà indexées : ces cas valent contrat, pas
// couverture de confort.

describe('slugify', () => {
  it('déplie les accents plutôt que de les supprimer', () => {
    expect(slugify('Crème brûlée')).toBe('creme-brulee');
    expect(slugify('Noël')).toBe('noel');
    expect(slugify('ça va')).toBe('ca-va');
  });

  it('passe en minuscules', () => {
    expect(slugify('Mug BLEU')).toBe('mug-bleu');
  });

  it('réduit toute suite d’espaces, tirets et soulignés à un seul tiret', () => {
    expect(slugify('mug   bleu')).toBe('mug-bleu');
    expect(slugify('mug___bleu')).toBe('mug-bleu');
    expect(slugify('mug---bleu')).toBe('mug-bleu');
    expect(slugify('mug - bleu')).toBe('mug-bleu');
  });

  it('retire la ponctuation sans la remplacer par un séparateur', () => {
    expect(slugify("L'été")).toBe('lete');
    expect(slugify('mug (bleu)')).toBe('mug-bleu');
    expect(slugify('50% coton')).toBe('50-coton');
  });

  it('ne laisse jamais de tiret au bord', () => {
    expect(slugify('  mug bleu  ')).toBe('mug-bleu');
    expect(slugify('---mug---')).toBe('mug');
    expect(slugify('!mug!')).toBe('mug');
  });

  it('garde les chiffres et laisse un slug déjà propre intact', () => {
    expect(slugify('t-shirt-2026')).toBe('t-shirt-2026');
    expect(slugify(slugify('Crème brûlée'))).toBe('creme-brulee');
  });

  it('rend une chaîne vide quand il ne reste rien de représentable', () => {
    expect(slugify('')).toBe('');
    expect(slugify('!!!')).toBe('');
    expect(slugify('   ')).toBe('');
  });

  // Conséquence directe du filtre `[^\w\s-]` : un alphabet non latin ne survit pas au slug. Une
  // boutique qui nomme ses produits en grec ou en japonais obtient des slugs vides, donc collision
  // d'URL. Le cas n'est pas géré ; il est ici pour être visible plutôt que découvert en production.
  it('ne conserve rien d’un alphabet non latin — limite connue', () => {
    expect(slugify('日本語')).toBe('');
    expect(slugify('Ελλάδα')).toBe('');
  });
});
