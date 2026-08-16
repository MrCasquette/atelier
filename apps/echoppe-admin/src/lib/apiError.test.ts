import { describe, expect, it } from 'bun:test';
import { errorMessage } from './apiError';

// L'ordre de lecture d'ADR-0050, vérifié bout à bout : la faute d'abord, `message` ensuite, le texte
// de l'appelant en dernier. C'est cet ordre qui permettra de retirer `message` sans toucher aux vues.

describe('une route migrée : la surface écrit son texte', () => {
  it('rend la faute, et ignore le message hérité que l’API remplit encore', () => {
    const text = errorMessage(
      {
        value: {
          fault: { code: 'in_use', resource: 'option_value', usedBy: 'variant' },
          message: 'texte serveur qui ne doit pas être lu',
        },
      },
      'repli',
    );

    expect(text).toContain('valeur d’option');
    expect(text).toContain('variante');
    expect(text).not.toContain('texte serveur');
  });

  it('accorde en genre — ce que le domaine n’a jamais eu à savoir', () => {
    const feminine = errorMessage({ value: { fault: { code: 'not_found', resource: 'variant' } } }, '');
    const masculine = errorMessage({ value: { fault: { code: 'not_found', resource: 'product' } } }, '');

    expect(feminine).toBe('Variante introuvable');
    expect(masculine).toBe('Produit introuvable');
  });
});

describe('le repli, qui est la partie obligatoire', () => {
  it('retombe sur `message` pour un code que ce catalogue ne connaît pas encore', () => {
    // Cas réel de la transition : la route est migrée, mais l'administration n'a pas encore d'entrée
    // pour ce code. Elle ne doit surtout pas afficher une clé brute.
    const text = errorMessage(
      {
        value: {
          fault: { code: 'insufficient_stock', available: 2, requested: 5 },
        },
      },
      'repli',
    );

    expect(text).toBe('Stock insuffisant : 2 disponible(s) pour 5 demandé(s)');
  });

  it('retombe sur le texte de l’appelant pour un code que ce catalogue ignore', () => {
    // Le cas n'est PAS théorique : l'API livrera un jour un code qu'une administration déployée
    // plus tôt ne connaîtra pas. C'est ce qui rend le repli obligatoire (ADR-0050 §6).
    expect(errorMessage({ value: { fault: { code: 'entity_locked' } } }, 'repli')).toBe('repli');
  });

  it('ignore un `message` résiduel : le serveur n’écrit plus de français', () => {
    // Le champ a été retiré du contrat en fin de migration. S'il reparaissait — vieux serveur,
    // proxy bavard —, il ne doit pas court-circuiter le catalogue de cette surface.
    expect(errorMessage({ value: { message: 'Ce slug est déjà pris' } }, 'repli')).toBe('repli');
  });

  it('n’utilise le texte de l’appelant que si le serveur s’est tu', () => {
    expect(errorMessage({ value: undefined }, 'Erreur lors de la mise à jour')).toBe(
      'Erreur lors de la mise à jour',
    );
  });

  it('ne prend pas une donnée quelconque pour une faute', () => {
    // `fault` sans discriminant n'est pas une faute : le guard le rejette, le repli s'applique.
    expect(errorMessage({ value: { fault: { resource: 'product' } } }, 'repli')).toBe('repli');
  });
});
