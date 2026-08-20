import { describe, expect, it } from 'bun:test';
import type { Registry } from './model';
import {
  checkSection,
  compileSections,
  registryIssues,
  registryToRows,
  rowsToRegistry,
  unknownRefTargets,
} from './registry';

// Ce fichier n'a plus rien à contourner. Il tenait naguère dans `@repo/pages`, où éprouver ces deux
// fonctions — qui n'interrogent rien — obligeait à poser une fausse `DATABASE_URL` puis à différer
// l'import, parce que le module voisin importait `db` au niveau module. ADR-0059 a séparé les deux.

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

// La traduction d'un champ déclaré en validateur exécutable est le cœur du paquet, et elle n'était
// couverte par RIEN : elle vivait derrière une lecture en base (ADR-0059).
describe('compilation d’un registre', () => {
  const hero = registry({
    sections: {
      hero: {
        name: 'hero',
        fields: [
          { name: 'titre', kind: 'text' },
          { name: 'sous_titre', kind: 'text', required: false },
        ],
      },
    },
  });

  it('compile un validateur par section, et rien pour les composants', () => {
    const compiled = registry({
      sections: { hero: { name: 'hero', fields: [{ name: 'titre', kind: 'text' }] } },
      components: { bouton: { name: 'bouton', fields: [{ name: 'libelle', kind: 'text' }] } },
    });

    const checks = compileSections(compiled);

    expect([...checks.keys()]).toEqual(['hero']);
  });

  it('accepte une donnée conforme', () => {
    const checks = compileSections(hero);

    expect(checkSection(checks, 'hero', { titre: 'Bonjour' })).toEqual({ ok: true });
  });

  it('refuse une donnée invalide en nommant ses fautes', () => {
    const checks = compileSections(hero);

    const verdict = checkSection(checks, 'hero', { titre: 42 });

    expect(verdict.ok).toBe(false);
    if (verdict.ok || verdict.reason !== 'invalid') throw new Error('verdict inattendu');
    expect(verdict.issues.length).toBeGreaterThan(0);
  });

  it('distingue une section introuvable d’une donnée invalide', () => {
    const checks = compileSections(hero);

    expect(checkSection(checks, 'inconnue', {})).toEqual({ ok: false, reason: 'unknown_type' });
  });
});

// Les deux traductions se répondent : ce qui part en base doit revenir identique.
describe('registre ↔ lignes', () => {
  const full = registry({
    sections: { hero: { name: 'hero', label: 'Bandeau', fields: [{ name: 'titre', kind: 'text' }] } },
    components: { bouton: { name: 'bouton', fields: [{ name: 'libelle', kind: 'text' }] } },
  });

  it('aplatit sections et composants dans le même espace de noms', () => {
    const rows = registryToRows(full);

    expect(rows.map((row) => [row.name, row.role])).toEqual([
      ['hero', 'section'],
      ['bouton', 'component'],
    ]);
  });

  it('fait l’aller-retour sans rien perdre', () => {
    const rows = registryToRows(full).map((row) => ({ ...row, fields: row.fields }));

    expect(rowsToRegistry(rows)).toEqual(full);
  });

  it('refuse un stockage corrompu plutôt que d’en déduire un registre', () => {
    const corrupted = [
      { name: 'hero', role: 'section', label: null, icon: null, fields: 'pas un tableau' },
    ];

    expect(() => rowsToRegistry(corrupted)).toThrow(/corruption/);
  });
});
