import { describe, expect, it } from 'bun:test';
import { type Components, compileFields, duplicateFieldNames } from './compile';
import type { SerializedField } from './model';

// La grammaire se teste sans DATABASE_URL — c'est la promesse du paquet, et ce fichier est ce qui
// la tient. Ce qu'on verrouille ici : la traduction d'une déclaration en validateur, et la garantie
// d'unicité que la séquence a cessé d'offrir gratuitement (ADR-0049).

const none: Components = {};

describe('un champ requis ou non', () => {
  it('accepte l’absence d’un champ optionnel, refuse celle d’un requis', () => {
    const check = compileFields(
      [
        { name: 'titre', kind: 'text', required: true },
        { name: 'sous', kind: 'text' },
      ],
      none,
    );

    expect(check.Check({ titre: 'a', sous: 'b' })).toBe(true);
    expect(check.Check({ titre: 'a' })).toBe(true);
    expect(check.Check({ sous: 'b' })).toBe(false);
  });
});

describe('chaque primitive contraint ce qu’elle annonce', () => {
  it('borne un texte', () => {
    const check = compileFields(
      [{ name: 'x', kind: 'text', required: true, minLength: 2, maxLength: 4 }],
      none,
    );

    expect(check.Check({ x: 'ab' })).toBe(true);
    expect(check.Check({ x: 'a' })).toBe(false);
    expect(check.Check({ x: 'abcde' })).toBe(false);
  });

  it('distingue un entier d’un décimal', () => {
    const integer = compileFields(
      [{ name: 'x', kind: 'number', required: true, integer: true, min: 0, max: 10 }],
      none,
    );
    const decimal = compileFields([{ name: 'x', kind: 'number', required: true }], none);

    expect(integer.Check({ x: 3 })).toBe(true);
    expect(integer.Check({ x: 3.5 })).toBe(false);
    expect(integer.Check({ x: 11 })).toBe(false);
    expect(decimal.Check({ x: 3.5 })).toBe(true);
  });

  it('sépare une date d’une date-heure', () => {
    const day = compileFields([{ name: 'x', kind: 'date', required: true }], none);
    const moment = compileFields([{ name: 'x', kind: 'date', required: true, time: true }], none);

    expect(day.Check({ x: '2026-08-15' })).toBe(true);
    expect(day.Check({ x: 'pas une date' })).toBe(false);
    expect(moment.Check({ x: '2026-08-15T10:00:00Z' })).toBe(true);
  });

  it('ferme un enum sur ses options, et l’ouvre au tableau si multiple', () => {
    const one = compileFields(
      [
        {
          name: 'x',
          kind: 'enum',
          required: true,
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        },
      ],
      none,
    );
    const many = compileFields(
      [
        {
          name: 'x',
          kind: 'enum',
          required: true,
          multiple: true,
          options: [{ value: 'a', label: 'A' }],
        },
      ],
      none,
    );

    expect(one.Check({ x: 'a' })).toBe(true);
    expect(one.Check({ x: 'c' })).toBe(false);
    expect(many.Check({ x: ['a'] })).toBe(true);
    expect(many.Check({ x: 'a' })).toBe(false);
  });

  it('attend un uuid pour une image comme pour une référence', () => {
    const check = compileFields(
      [
        { name: 'img', kind: 'image', required: true },
        { name: 'ref', kind: 'ref', to: 'article', required: true },
      ],
      none,
    );
    const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

    expect(check.Check({ img: uuid, ref: uuid })).toBe(true);
    expect(check.Check({ img: 'pas-un-uuid', ref: uuid })).toBe(false);
  });
});

describe('les champs qui en résolvent d’autres', () => {
  const components: Components = {
    bouton: { fields: [{ name: 'libelle', kind: 'text', required: true }] },
  };

  it('inline un component, et borne une liste', () => {
    const single = compileFields([{ name: 'cta', kind: 'component', of: 'bouton' }], components);
    const list = compileFields(
      [{ name: 'ctas', kind: 'list', of: 'bouton', required: true, min: 1, max: 2 }],
      components,
    );

    expect(single.Check({ cta: { libelle: 'ok' } })).toBe(true);
    expect(single.Check({ cta: { libelle: 42 } })).toBe(false);
    expect(list.Check({ ctas: [{ libelle: 'ok' }] })).toBe(true);
    expect(list.Check({ ctas: [] })).toBe(false);
  });

  it('descend dans un répéteur imbriqué', () => {
    const check = compileFields(
      [
        {
          name: 'lignes',
          kind: 'repeater',
          required: true,
          fields: [
            {
              name: 'sous',
              kind: 'repeater',
              required: true,
              fields: [{ name: 'x', kind: 'text', required: true }],
            },
          ],
        },
      ],
      none,
    );

    expect(check.Check({ lignes: [{ sous: [{ x: 'a' }] }] })).toBe(true);
    expect(check.Check({ lignes: [{ sous: [{ x: 1 }] }] })).toBe(false);
  });

  it('refuse un component introuvable plutôt que de l’ignorer', () => {
    expect(() => compileFields([{ name: 'cta', kind: 'component', of: 'absent' }], none)).toThrow(
      /introuvable/,
    );
  });

  it('refuse une référence circulaire au lieu de boucler', () => {
    const cyclic: Components = {
      a: { fields: [{ name: 'b', kind: 'component', of: 'b' }] },
      b: { fields: [{ name: 'a', kind: 'component', of: 'a' }] },
    };

    expect(() => compileFields([{ name: 'x', kind: 'component', of: 'a' }], cyclic)).toThrow(
      /circulaire/,
    );
  });

  it('admet le même component deux fois côte à côte — ce n’est pas un cycle', () => {
    const check = compileFields(
      [
        { name: 'gauche', kind: 'component', of: 'bouton' },
        { name: 'droite', kind: 'component', of: 'bouton' },
      ],
      components,
    );

    expect(check.Check({ gauche: { libelle: 'g' }, droite: { libelle: 'd' } })).toBe(true);
  });
});

// Ce que la séquence a cessé de garantir : deux clés identiques ne coexistaient pas dans un objet,
// deux éléments de tableau si. La vérification est exportée parce que les entités ont leur propre
// chemin d'écriture (`planEntities`) — d'où les cas « chemin entités » ci-dessous, qui appellent la
// fonction telle qu'elle l'appelle.
describe('les doublons de noms se voient, à tous les étages', () => {
  it('ne dit rien quand il n’y a rien à dire', () => {
    const fields: SerializedField[] = [
      { name: 'titre', kind: 'text' },
      { name: 'corps', kind: 'richText' },
    ];

    expect(duplicateFieldNames('hero', fields)).toEqual([]);
  });

  it('nomme le fautif, préfixé de son propriétaire', () => {
    const fields: SerializedField[] = [
      { name: 'titre', kind: 'text' },
      { name: 'titre', kind: 'richText' },
    ];

    expect(duplicateFieldNames('hero', fields)).toEqual(['hero.titre']);
  });

  it('descend dans un répéteur et donne le chemin complet', () => {
    const fields: SerializedField[] = [
      {
        name: 'lignes',
        kind: 'repeater',
        fields: [
          { name: 'x', kind: 'text' },
          { name: 'x', kind: 'number' },
        ],
      },
    ];

    expect(duplicateFieldNames('article', fields)).toEqual(['article.lignes.x']);
  });

  it('descend dans un répéteur imbriqué', () => {
    const fields: SerializedField[] = [
      {
        name: 'lignes',
        kind: 'repeater',
        fields: [
          {
            name: 'sous',
            kind: 'repeater',
            fields: [
              { name: 'x', kind: 'text' },
              { name: 'x', kind: 'text' },
            ],
          },
        ],
      },
    ];

    expect(duplicateFieldNames('article', fields)).toEqual(['article.lignes.sous.x']);
  });

  it('laisse un répéteur redéclarer un nom du niveau au-dessus — les portées sont distinctes', () => {
    const fields: SerializedField[] = [
      { name: 'titre', kind: 'text' },
      { name: 'lignes', kind: 'repeater', fields: [{ name: 'titre', kind: 'text' }] },
    ];

    expect(duplicateFieldNames('article', fields)).toEqual([]);
  });

  it('laisse deux répéteurs frères employer les mêmes noms', () => {
    const fields: SerializedField[] = [
      { name: 'gauche', kind: 'repeater', fields: [{ name: 'x', kind: 'text' }] },
      { name: 'droite', kind: 'repeater', fields: [{ name: 'x', kind: 'text' }] },
    ];

    expect(duplicateFieldNames('article', fields)).toEqual([]);
  });

  it('rend TOUTES les fautes, pas la première — c’est ce qui rend le rapport actionnable', () => {
    const fields: SerializedField[] = [
      { name: 'titre', kind: 'text' },
      { name: 'titre', kind: 'text' },
      { name: 'corps', kind: 'text' },
      { name: 'corps', kind: 'text' },
      {
        name: 'lignes',
        kind: 'repeater',
        fields: [
          { name: 'x', kind: 'text' },
          { name: 'x', kind: 'text' },
        ],
      },
    ];

    expect(duplicateFieldNames('article', fields)).toEqual([
      'article.titre',
      'article.corps',
      'article.lignes.x',
    ]);
  });

  it('compte trois fois un nom déclaré trois fois', () => {
    const fields: SerializedField[] = [
      { name: 'titre', kind: 'text' },
      { name: 'titre', kind: 'text' },
      { name: 'titre', kind: 'text' },
    ];

    expect(duplicateFieldNames('hero', fields)).toEqual(['hero.titre', 'hero.titre']);
  });
});
