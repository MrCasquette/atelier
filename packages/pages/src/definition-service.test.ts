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

const { registryIssues, unknownRefTargets } = await import('./definition-service');

const registry = (parts: Partial<Registry> = {}): Registry => ({
  version: 1,
  sections: {},
  components: {},
  ...parts,
});

describe('cohérence d’un registre', () => {
  it('ne dit rien d’un registre sain', () => {
    const sane = registry({
      sections: {
        hero: { name: 'hero', fields: [{ name: 'titre', kind: 'text' }] },
      },
      components: {
        bouton: { name: 'bouton', fields: [{ name: 'libelle', kind: 'text' }] },
      },
    });

    expect(registryIssues(sane)).toEqual([]);
  });

  // Ce que la séquence a cessé de garantir gratuitement (ADR-0049) : deux clés identiques ne
  // coexistaient pas dans un objet, deux éléments de tableau si.
  it('refuse deux champs de même nom, en donnant leur chemin', () => {
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

    expect(registryIssues(doublon)).toEqual([{ path: 'hero.titre', reason: 'duplicate_field' }]);
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

    expect(registryIssues(doublon)).toEqual([
      { path: 'bouton.libelle', reason: 'duplicate_field' },
    ]);
  });

  it('refuse un composant référencé mais absent', () => {
    const manquant = registry({
      sections: {
        hero: { name: 'hero', fields: [{ name: 'cta', kind: 'component', of: 'absent' }] },
      },
    });

    expect(registryIssues(manquant)).toEqual([{ path: 'hero.cta', reason: 'unknown_component' }]);
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

    // Le cycle se voit en descendant, donc il est nommé à l'endroit où il se referme.
    expect(registryIssues(cycle)).toContainEqual({
      path: 'hero.x.b.a',
      reason: 'circular_component',
    });
  });

  it('rend TOUTES les incohérences, pas seulement la première rencontrée', () => {
    // Le verdict passait naguère par une exception : elle s'arrêtait au premier prédicat qui
    // levait, et le dev corrigeait son registre en autant d'allers-retours qu'il avait de fautes.
    const fautif = registry({
      sections: {
        hero: {
          name: 'hero',
          fields: [
            { name: 'titre', kind: 'text' },
            { name: 'titre', kind: 'text' },
            { name: 'cta', kind: 'component', of: 'absent' },
          ],
        },
      },
    });

    expect(registryIssues(fautif)).toEqual([
      { path: 'hero.titre', reason: 'duplicate_field' },
      { path: 'hero.cta', reason: 'unknown_component' },
    ]);
  });

  it('n’émet aucune prose : ni phrase, ni ponctuation d’affichage', () => {
    // ADR-0050 §3. C'est ce qui a changé de nature ici : le verdict était un `error.message` que la
    // route promouvait tel quel en réponse HTTP.
    const fautif = registry({
      sections: {
        hero: { name: 'hero', fields: [{ name: 'cta', kind: 'component', of: 'absent' }] },
      },
    });

    for (const issue of registryIssues(fautif)) {
      expect(issue.path).not.toMatch(/[«»—·→\s]/);
    }
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

  it('nomme la CIBLE, et non le champ qui la vise', () => {
    // Le chemin ne traverse pas : l'appelant vient de soumettre le registre entier, donc il
    // retrouve seul quels champs citent une cible refusée (ADR-0050 §5).
    const faute = registry({
      sections: {
        hero: { name: 'hero', fields: [{ name: 'vedette', kind: 'ref', to: 'inconnue' }] },
      },
    });

    expect(unknownRefTargets(faute, ['product'])).toEqual(['inconnue']);
  });

  it('descend dans les répéteurs', () => {
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

    expect(unknownRefTargets(faute, [])).toEqual(['inconnue']);
  });

  it('déduplique une cible citée par plusieurs champs', () => {
    // Deux propriétaires distincts, une seule chose à inscrire : une seule entrée.
    const faute = registry({
      sections: {
        hero: { name: 'hero', fields: [{ name: 'a', kind: 'ref', to: 'inconnue' }] },
      },
      components: {
        hero2: { name: 'hero2', fields: [{ name: 'a', kind: 'ref', to: 'inconnue' }] },
      },
    });

    expect(unknownRefTargets(faute, [])).toEqual(['inconnue']);
  });

  it('rend en revanche DEUX cibles distinctes', () => {
    const faute = registry({
      sections: {
        hero: {
          name: 'hero',
          fields: [
            { name: 'a', kind: 'ref', to: 'inconnue' },
            { name: 'b', kind: 'ref', to: 'autre' },
          ],
        },
      },
    });

    expect(unknownRefTargets(faute, []).sort()).toEqual(['autre', 'inconnue']);
  });

  it('inspecte les composants comme les sections', () => {
    const faute = registry({
      components: {
        carte: { name: 'carte', fields: [{ name: 'lien', kind: 'ref', to: 'inconnue' }] },
      },
    });

    expect(unknownRefTargets(faute, ['product'])).toEqual(['inconnue']);
  });
});
