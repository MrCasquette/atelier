import { describe, expect, test } from 'bun:test';
import { defineComponent, defineContent, defineSection } from './define.js';
import { field as f } from './field.js';
import { link } from './link.js';
import { serialize } from './serialize.js';
import type { InferData } from './types.js';

// Un component imbriqué s'écrit de deux façons — la Definition NUE (`cta: link`) et `f.component`
// (ADR-0075). Elles produisent la même donnée ; seule la seconde porte une méta d'usage. Ce que ces
// cas verrouillent, c'est justement qu'elles ne divergent pas ailleurs : même `kind` au registre,
// même auto-collecte, même type inféré.

describe('déclarer un component imbriqué', () => {
  test('porte la méta que la Definition nue ne peut pas loger', () => {
    const registry = serialize(
      defineContent({
        sections: [
          defineSection('hero', {
            fields: { cta: f.component(link, { required: true, label: 'Appel à action' }) },
          }),
        ],
      }),
    );

    expect(registry.sections.hero?.fields).toEqual([
      {
        name: 'cta',
        kind: 'component',
        of: 'link',
        label: 'Appel à action',
        hint: undefined,
        required: true,
      },
    ]);
    expect(registry.components.link).toBeDefined();
  });

  test("la forme nue pousse le JSON qu'elle poussait avant", () => {
    const registry = serialize(
      defineContent({ sections: [defineSection('hero', { fields: { cta: link } })] }),
    );

    // Aucune clé méta ajoutée : un dépôt qui n'adopte pas `f.component` ne voit pas
    // `content:check` se dire désynchronisé sans qu'un fichier ait changé.
    expect(registry.sections.hero?.fields).toEqual([{ name: 'cta', kind: 'component', of: 'link' }]);
  });

  test('auto-collecte comme la forme nue, et une seule fois', () => {
    const registry = serialize(
      defineContent({
        sections: [
          defineSection('hero', {
            fields: { gauche: f.component(link), droite: link },
          }),
        ],
      }),
    );

    expect(Object.keys(registry.components)).toEqual(['link']);
  });

  test('ne boucle pas sur un component qui se cite lui-même', () => {
    const noeud = defineComponent('noeud', { fields: { titre: f.text() } });
    // Le cycle se ferme après coup : `fields` est lu à la sérialisation, pas à la déclaration.
    Object.assign(noeud.fields, { enfant: f.component(noeud) });

    const registry = serialize(
      defineContent({ sections: [defineSection('arbre', { fields: { racine: noeud } })] }),
    );

    expect(registry.components.noeud?.fields.map((field) => field.name)).toEqual([
      'titre',
      'enfant',
    ]);
  });
});

describe('inférence de la donnée éditée', () => {
  test('appelée sans options, une fabrique garde les exigences du type imbriqué', () => {
    const inner = defineComponent('inner', { fields: { titre: f.text({ required: true }) } });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const section = defineSection('bloc', {
      fields: { nu: inner, comp: f.component(inner), liste: f.list(inner) },
    });

    // La régression que ces trois lignes tiennent : `f.component(inner)` et `f.list(inner)` —
    // SANS second argument — rendaient facultatifs les champs requis de `inner`, là où la forme
    // nue et la forme `(inner, {})` restaient justes. Un paramètre de type optionnel ne prend pas
    // son défaut quand l'argument manque : il prend le type contextuel, ici `Fields`, dont le `of`
    // large écrasait le littéral. Signalé par un consommateur du paquet publié.
    // @ts-expect-error `titre` est requis dans la définition nue
    const nu: InferData<typeof section> = { nu: {}, comp: { titre: 'x' }, liste: [] };
    // @ts-expect-error `titre` est requis à travers `f.component` sans options
    const comp: InferData<typeof section> = { nu: { titre: 'x' }, comp: {}, liste: [] };
    // @ts-expect-error `titre` est requis à travers `f.list` sans options
    const liste: InferData<typeof section> = { nu: { titre: 'x' }, comp: { titre: 'x' }, liste: [{}] };

    expect([nu, comp, liste]).toHaveLength(3);
  });

  test('un component requis devient une clé requise', () => {
    // Ces constantes ne sont lues QUE par `typeof` — c'est le propos du test.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const dur = defineSection('dur', { fields: { cta: f.component(link, { required: true }) } });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mou = defineSection('mou', { fields: { cta: f.component(link) } });

    // La vérification est au type-check : ces valeurs ne compilent que si l'inférence est juste.
    const rempli: InferData<typeof dur> = { cta: { label: 'Voir', href: '/produits' } };
    const vide: InferData<typeof mou> = {};

    // Le témoin de la fermeture : sans `required`, l'omission passait déjà — c'est l'inverse qui
    // n'existait pas. Si `RequiredKeys` cesse de compter un component, cette ligne compile et le
    // type-check échoue ici, nommément.
    // @ts-expect-error `cta` est requis : l'omettre ne compile pas.
    const manquant: InferData<typeof dur> = {};

    expect(rempli.cta.label).toBe('Voir');
    expect(vide.cta).toBeUndefined();
    expect(Object.keys(manquant)).toHaveLength(0);
  });
});
