import { describe, expect, it } from 'bun:test';
import type { Registry } from './definition-model';

// `definition-service.ts` importe `db` au niveau module, et `@repo/db` LÈVE à l'import quand
// `DATABASE_URL` manque. La logique pure de ce fichier — cohérence d'un registre, cibles inconnues —
// est donc soudée à la connexion par le graphe d'imports, alors qu'elle n'interroge rien.
//
// On pose une URL factice : `postgres()` est paresseux, aucune connexion n'est ouverte. C'est un
// contournement, pas un modèle — il disparaîtrait si la partie pure vivait dans un module qui
// n'importe pas `db`.
process.env.DATABASE_URL ??= 'postgres://unused@localhost:5432/unused';

const { assertRegistryCoherent, unknownRefTargets } = await import('./definition-service');

const registry = (parts: Partial<Registry> = {}): Registry => ({
  version: 1,
  sections: {},
  components: {},
  ...parts,
});

describe('cohérence d’un registre', () => {
  it('laisse passer un registre sain', () => {
    const sane = registry({
      sections: {
        hero: { name: 'hero', fields: [{ name: 'titre', kind: 'text' }] },
      },
      components: {
        bouton: { name: 'bouton', fields: [{ name: 'libelle', kind: 'text' }] },
      },
    });

    expect(() => assertRegistryCoherent(sane)).not.toThrow();
  });

  // Ce que la séquence a cessé de garantir gratuitement (ADR-0049) : deux clés identiques ne
  // coexistaient pas dans un objet, deux éléments de tableau si.
  it('refuse deux champs de même nom, en les nommant', () => {
    const doublon = registry({
      sections: {
        hero: {
          name: 'hero',
          fields: [
            { name: 'titre', kind: 'text' },
            { name: 'titre', kind: 'richText' },
          ],
        },
      },
    });

    expect(() => assertRegistryCoherent(doublon)).toThrow(/hero\.titre/);
  });

  it('descend dans les composants autant que dans les sections', () => {
    const doublon = registry({
      components: {
        bouton: {
          name: 'bouton',
          fields: [
            { name: 'libelle', kind: 'text' },
            { name: 'libelle', kind: 'text' },
          ],
        },
      },
    });

    expect(() => assertRegistryCoherent(doublon)).toThrow(/bouton\.libelle/);
  });

  it('refuse un composant référencé mais absent', () => {
    const manquant = registry({
      sections: {
        hero: { name: 'hero', fields: [{ name: 'cta', kind: 'component', of: 'absent' }] },
      },
    });

    expect(() => assertRegistryCoherent(manquant)).toThrow(/introuvable/);
  });

  it('refuse un cycle de composants plutôt que de boucler', () => {
    const cycle = registry({
      sections: {
        hero: { name: 'hero', fields: [{ name: 'x', kind: 'component', of: 'a' }] },
      },
      components: {
        a: { name: 'a', fields: [{ name: 'b', kind: 'component', of: 'b' }] },
        b: { name: 'b', fields: [{ name: 'a', kind: 'component', of: 'a' }] },
      },
    });

    expect(() => assertRegistryCoherent(cycle)).toThrow(/circulaire/);
  });
});

describe('cibles référençables inconnues', () => {
  it('ne dit rien quand la cible est inscrite', () => {
    const sane = registry({
      sections: {
        hero: { name: 'hero', fields: [{ name: 'vedette', kind: 'ref', to: 'product' }] },
      },
    });

    expect(unknownRefTargets(sane, ['product', 'page'])).toEqual([]);
  });

  it('nomme le champ fautif et la cible qu’il vise', () => {
    const faute = registry({
      sections: {
        hero: { name: 'hero', fields: [{ name: 'vedette', kind: 'ref', to: 'inconnue' }] },
      },
    });

    expect(unknownRefTargets(faute, ['product'])).toEqual(['hero.vedette → « inconnue »']);
  });

  it('descend dans les répéteurs, en gardant le chemin', () => {
    const faute = registry({
      sections: {
        hero: {
          name: 'hero',
          fields: [
            {
              name: 'lignes',
              kind: 'repeater',
              fields: [{ name: 'lien', kind: 'ref', to: 'inconnue' }],
            },
          ],
        },
      },
    });

    expect(unknownRefTargets(faute, [])).toEqual(['hero.lignes.lien → « inconnue »']);
  });

  it('déduplique une même faute répétée', () => {
    const faute = registry({
      sections: {
        hero: { name: 'hero', fields: [{ name: 'a', kind: 'ref', to: 'inconnue' }] },
      },
      components: {
        hero2: { name: 'hero2', fields: [{ name: 'a', kind: 'ref', to: 'inconnue' }] },
      },
    });

    // Deux propriétaires distincts : deux fautes, parce que le chemin diffère.
    expect(unknownRefTargets(faute, []).sort()).toEqual([
      'hero.a → « inconnue »',
      'hero2.a → « inconnue »',
    ]);
  });

  it('inspecte les composants comme les sections', () => {
    const faute = registry({
      components: {
        carte: { name: 'carte', fields: [{ name: 'lien', kind: 'ref', to: 'inconnue' }] },
      },
    });

    expect(unknownRefTargets(faute, ['product'])).toEqual(['carte.lien → « inconnue »']);
  });
});
