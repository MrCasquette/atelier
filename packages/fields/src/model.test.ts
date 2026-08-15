import { describe, expect, it } from 'bun:test';
import { type Static, t } from 'elysia';
import { TypeCompiler } from 'elysia/type-system';
import { type SerializedField, serializedFieldSchema, serializedFieldShape } from './model';

// Verrou de l'adaptateur statique d'ADR-0049.
//
// `model.ts` décrit la grammaire DEUX fois : en TypeBox (ce qui valide) et en TypeScript
// (ce qu'Elysia sait comparer). Cette duplication n'est tolérable que parce qu'une divergence
// échoue ICI, à la compilation. Si ce fichier devient vert alors qu'il ne devrait pas, la
// duplication redevient une dette silencieuse — et c'est le seul scénario qui rendrait le
// contournement inacceptable.
//
// Il faut DEUX contrôles, et ni l'un ni l'autre ne suffit :
//
//   1. l'assignabilité mutuelle voit les propriétés REQUISES et les mauvais types, mais PAS la
//      disparition d'une propriété optionnelle — `{ a?: number }` et `{}` sont mutuellement
//      assignables en TypeScript, et la grammaire est massivement optionnelle ;
//   2. l'égalité des `keyof`, membre par membre, voit ça. Sur l'union ENTIÈRE elle ne verrait
//      rien : `keyof (A | B)` rend l'INTERSECTION des clés, soit `name` et `kind` seuls.

type Schema = Static<typeof serializedFieldShape>;

/** Assignabilité dans les deux sens. Les tuples empêchent la distribution sur les unions. */
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

type KeysOf<U, K> = keyof Extract<U, { kind: K }>;

/**
 * Mêmes clés de part et d'autre, pour un `kind` donné.
 *
 * `[…] extends [never]` et non `… extends never` : un conditionnel se distribue sur l'union vide et
 * rend `never`, donc la version nue s'auto-annule exactement dans le cas qu'elle doit attraper.
 */
type SameKeys<A, B, K> = [Exclude<KeysOf<A, K>, KeysOf<B, K>>] extends [never]
  ? [Exclude<KeysOf<B, K>, KeysOf<A, K>>] extends [never]
    ? true
    : never
  : never;

// Un contrôle par `kind`, littéral par littéral. La version générique — un type mappé sur
// `SerializedField['kind']` — ne marche PAS : avec un `K` générique, TypeScript diffère `Extract` et
// l'ensemble s'effondre en `never`, donnant un verrou vert qui ne voit rien. Vérifié.
//
// ⚠️ Corollaire : ajouter une DOUZIÈME primitive sans ajouter sa ligne ici passerait inaperçu de ce
// contrôle-ci. C'est `structure` qui couvre ce cas — un membre entier absent de l'adaptateur casse
// l'assignabilité.
const structure: Mutual<Schema, SerializedField> = true;
const text: SameKeys<Schema, SerializedField, 'text'> = true;
const richText: SameKeys<Schema, SerializedField, 'richText'> = true;
const numberField: SameKeys<Schema, SerializedField, 'number'> = true;
const booleanField: SameKeys<Schema, SerializedField, 'boolean'> = true;
const date: SameKeys<Schema, SerializedField, 'date'> = true;
const enumField: SameKeys<Schema, SerializedField, 'enum'> = true;
const image: SameKeys<Schema, SerializedField, 'image'> = true;
const ref: SameKeys<Schema, SerializedField, 'ref'> = true;
const component: SameKeys<Schema, SerializedField, 'component'> = true;
const list: SameKeys<Schema, SerializedField, 'list'> = true;
const repeater: SameKeys<Schema, SerializedField, 'repeater'> = true;

describe('l’adaptateur statique dit la même chose que le schéma', () => {
  it('concorde, membre par membre', () => {
    // Ces valeurs ne sont que le résidu runtime des assertions ci-dessus : ce qui compte s'est joué
    // à la compilation. Une divergence y aurait rendu `never`, et le fichier ne compilerait pas.
    expect([
      structure,
      text,
      richText,
      numberField,
      booleanField,
      date,
      enumField,
      image,
      ref,
      component,
      list,
      repeater,
    ]).toEqual(Array(12).fill(true));
  });
});

describe('t.Unsafe ne touche ni à la validation ni au contrat', () => {
  it('émet exactement le même schéma', () => {
    // C'est ce qui rend le contournement acceptable : le JSON émis part tel quel dans l'OpenAPI,
    // donc dans le SDK. S'il divergeait, ce serait un changement de contrat déguisé en typage.
    expect(JSON.stringify(serializedFieldSchema)).toBe(JSON.stringify(serializedFieldShape));
  });

  it('valide et refuse comme le schéma récursif', () => {
    const check = TypeCompiler.Compile(t.Array(serializedFieldSchema));

    expect(check.Check([{ name: 'titre', kind: 'text' }])).toBe(true);
    // La récursion est intacte : un répéteur dans un répéteur reste déclarable (ADR-0049).
    expect(
      check.Check([
        {
          name: 'lignes',
          kind: 'repeater',
          fields: [{ name: 'sous', kind: 'repeater', fields: [{ name: 'x', kind: 'text' }] }],
        },
      ]),
    ).toBe(true);

    expect(check.Check([{ name: 'titre', kind: 'inconnu' }])).toBe(false);
    // Un champ sans nom n'est plus un champ : le nom portait l'identité, il est désormais une
    // propriété et reste obligatoire.
    expect(check.Check([{ kind: 'text' }])).toBe(false);
  });
});
