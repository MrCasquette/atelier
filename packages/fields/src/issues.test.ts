import { describe, expect, it } from 'bun:test';
import type { ValidationReason } from '@repo/shared';
import { type Components, compileFields } from './compile';
import { issuesOf } from './issues';
import type { SerializedField } from './model';

// Ce test REMESURE l'inventaire dont `issues.ts` est dérivé. C'est lui, et non une déclaration de
// version, qui tient la traduction :
//
// - si TypeBox renumérote son enum, ou si `@repo/fields` en résout une autre copie que celle
//   d'Elysia, les raisons obtenues cessent de correspondre et tout tombe ici ;
// - si `compile.ts` gagne une construction — un `t.Tuple`, un `pattern` —, elle émet un type absent
//   de la table, et le cas correspondant tombe sur le repli `type` au lieu de sa vraie raison.
//
// Chaque cas est donc écrit comme une DONNÉE fautive et sa correction attendue, pas comme un nom de
// `ValueErrorType` : c'est le contrat qu'on gèle, pas l'implémentation du validateur.

const components: Components = {
  bloc: { fields: [{ kind: 'text', name: 'titre', required: true } as SerializedField] },
};

const field = (definition: unknown): SerializedField => definition as SerializedField;

/** Les raisons d'une donnée, dédupliquées : l'ordre des erreurs ne fait pas partie du contrat. */
function reasonsFor(fields: SerializedField[], data: unknown): ValidationReason[] {
  const check = compileFields(fields, components);
  return [...new Set(issuesOf(check, data).map((issue) => issue.reason))];
}

describe('chaque construction de la grammaire tombe sur sa raison', () => {
  it('nomme `required` un champ requis absent — le cas dominant', () => {
    const fields = [field({ kind: 'text', name: 'titre', required: true })];
    expect(issuesOf(compileFields(fields, components), {})).toEqual([
      { path: '/titre', reason: 'required' },
    ]);
  });

  it('laisse passer un champ NON requis absent', () => {
    const fields = [field({ kind: 'text', name: 'titre', required: false })];
    expect(issuesOf(compileFields(fields, components), {})).toEqual([]);
  });

  it('nomme `type` un mauvais type de base, sur les cinq constructions concernées', () => {
    expect(reasonsFor([field({ kind: 'text', name: 'a', required: true })], { a: 4 })).toEqual([
      'type',
    ]);
    expect(reasonsFor([field({ kind: 'number', name: 'a', required: true })], { a: 'x' })).toEqual([
      'type',
    ]);
    expect(
      reasonsFor([field({ kind: 'boolean', name: 'a', required: true })], { a: 'oui' }),
    ).toEqual(['type']);
    expect(
      reasonsFor([field({ kind: 'list', name: 'a', required: true, of: 'bloc' })], { a: 'x' }),
    ).toEqual(['type']);
    expect(
      reasonsFor([field({ kind: 'component', name: 'a', required: true, of: 'bloc' })], { a: 'x' }),
    ).toEqual(['type']);
  });

  it('nomme `type` une racine qui n’est pas un objet, et la désigne par `/`', () => {
    const fields = [field({ kind: 'text', name: 'a', required: true })];
    expect(issuesOf(compileFields(fields, components), 'pas un objet')).toEqual([
      { path: '/', reason: 'type' },
    ]);
  });

  it('nomme `not_allowed` une valeur hors de la liste close, `multiple` ou non', () => {
    const options = [
      { value: 'x', label: 'X' },
      { value: 'y', label: 'Y' },
    ];
    // Le cas simple passe par un `Union`, le cas multiple par un `Literal` : deux types TypeBox
    // différents pour une seule et même faute. C'est exactement ce que le regroupement achète.
    expect(
      reasonsFor([field({ kind: 'enum', name: 'a', required: true, options })], { a: 'z' }),
    ).toEqual(['not_allowed']);
    expect(
      reasonsFor([field({ kind: 'enum', name: 'a', required: true, multiple: true, options })], {
        a: ['z'],
      }),
    ).toEqual(['not_allowed']);
  });

  it('nomme `type` — et non `not_allowed` — un entier invalide, malgré le même `Union`', () => {
    // `t.Integer` d'Elysia est une union de coercition `string | integer`. Sans la discrimination
    // par la forme du schéma, ce cas se rangeait sous « valeur non permise », ce qui est faux.
    expect(
      reasonsFor([field({ kind: 'number', name: 'a', required: true, integer: true })], { a: 1.5 }),
    ).toEqual(['type']);
  });

  it('distingue les deux bornes, sur les trois choses qui se mesurent', () => {
    const text = [field({ kind: 'text', name: 'a', required: true, minLength: 3, maxLength: 5 })];
    expect(reasonsFor(text, { a: 'ab' })).toEqual(['too_small']);
    expect(reasonsFor(text, { a: 'abcdefgh' })).toEqual(['too_large']);

    const nombre = [field({ kind: 'number', name: 'a', required: true, min: 2, max: 8 })];
    expect(reasonsFor(nombre, { a: 1 })).toEqual(['too_small']);
    expect(reasonsFor(nombre, { a: 9 })).toEqual(['too_large']);

    const liste = [field({ kind: 'list', name: 'a', required: true, of: 'bloc', min: 2, max: 3 })];
    expect(reasonsFor(liste, { a: [] })).toEqual(['too_small']);
    expect(
      reasonsFor(liste, { a: [{ titre: 'a' }, { titre: 'b' }, { titre: 'c' }, { titre: 'd' }] }),
    ).toEqual(['too_large']);

    const repeteur = [
      field({
        kind: 'repeater',
        name: 'a',
        required: true,
        min: 2,
        max: 3,
        fields: [field({ kind: 'text', name: 't', required: true })],
      }),
    ];
    expect(reasonsFor(repeteur, { a: [] })).toEqual(['too_small']);
  });

  it('nomme `format` les trois formes déclarables', () => {
    expect(
      reasonsFor([field({ kind: 'image', name: 'a', required: true })], { a: 'pas-un-uuid' }),
    ).toEqual(['format']);
    expect(
      reasonsFor([field({ kind: 'ref', name: 'a', required: true, to: 'page' })], { a: 'x' }),
    ).toEqual(['format']);
    expect(
      reasonsFor([field({ kind: 'date', name: 'a', required: true })], { a: 'pas-une-date' }),
    ).toEqual(['format']);
    expect(
      reasonsFor([field({ kind: 'date', name: 'a', required: true, time: true })], { a: 'x' }),
    ).toEqual(['format']);
  });
});

describe('le chemin localise la faute', () => {
  it('descend dans un répéteur, jusqu’à l’index et au nom du champ', () => {
    const fields = [
      field({
        kind: 'repeater',
        name: 'blocs',
        required: true,
        fields: [field({ kind: 'text', name: 'titre', required: true })],
      }),
    ];
    expect(issuesOf(compileFields(fields, components), { blocs: [{ titre: 'ok' }, {}] })).toEqual([
      { path: '/blocs/1/titre', reason: 'required' },
    ]);
  });

  it('rend une entrée PAR faute, sans en joindre aucune', () => {
    // La jointure est une décision de langue. Le domaine rend une liste ; la surface la met en forme.
    const fields = [
      field({ kind: 'text', name: 'titre', required: true }),
      field({ kind: 'number', name: 'vues', required: true }),
    ];
    expect(issuesOf(compileFields(fields, components), {})).toEqual([
      { path: '/titre', reason: 'required' },
      { path: '/vues', reason: 'required' },
    ]);
  });
});

describe('ce que la traduction n’émet pas', () => {
  it('n’émet AUCUNE prose : ni chemin rédigé, ni message de validateur', () => {
    // ADR-0050 §3. Sans cette garde, `${path} ${message}` revient par la porte de derrière.
    const fields = [field({ kind: 'text', name: 'a', required: true, minLength: 3 })];
    for (const issue of issuesOf(compileFields(fields, components), { a: 'ab' })) {
      expect(issue.path).toMatch(/^\/[\w/]*$/);
      expect(Object.keys(issue).sort()).toEqual(['path', 'reason']);
    }
  });

  it('ne reproche pas son TYPE à une valeur absente', () => {
    // TypeBox émet deux erreurs pour une propriété manquante : `ObjectRequiredProperty`, puis le
    // type de base sur `undefined`. La seconde ne demande rien de plus — et une surface qui affiche
    // toutes les fautes dirait « requis » et « mauvais type » sur le même champ vide.
    const fields = [field({ kind: 'number', name: 'vues', required: true })];
    expect(issuesOf(compileFields(fields, components), {})).toEqual([
      { path: '/vues', reason: 'required' },
    ]);
  });

  it('garde en revanche DEUX raisons distinctes sur un même chemin', () => {
    // Trop court ET mal formé : deux corrections, donc deux entrées. La déduplication ne va pas
    // jusqu'à écraser des fautes différentes.
    const fields = [
      field({ kind: 'text', name: 'a', required: true, minLength: 30, format: 'uuid' }),
    ];
    expect(issuesOf(compileFields(fields, components), { a: 'court' })).toEqual([
      { path: '/a', reason: 'too_small' },
      { path: '/a', reason: 'format' },
    ]);
  });

  it('ne déplie pas les branches d’une union en fautes distinctes', () => {
    // Un `enum` à trois options ne doit pas rendre trois fautes pour une seule valeur refusée.
    const options = [
      { value: 'x', label: 'X' },
      { value: 'y', label: 'Y' },
      { value: 'z', label: 'Z' },
    ];
    const fields = [field({ kind: 'enum', name: 'a', required: true, options })];
    expect(issuesOf(compileFields(fields, components), { a: 'w' })).toEqual([
      { path: '/a', reason: 'not_allowed' },
    ]);
  });
});
