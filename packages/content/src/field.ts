// Builders de champs. `field` (alias court `f`) est un objet de fabriques : chaque méthode
// retourne un descripteur de champ (cf. types.ts). Aucune validation ici — juste la construction
// du descripteur. La validation des données éditées vit côté API (P2b), pilotée par le registre.
//
// Les fabriques sont GÉNÉRIQUES avec des `const` type params : elles capturent littéralement les
// options passées (`required: true`, options d'enum, `of` d'une liste…) pour que l'inférence de
// types (`InferData`, cf. types.ts) puisse dériver la forme exacte de la donnée. La normalisation
// (ex. options d'enum) n'a PAS lieu ici mais à la sérialisation, afin de préserver les littéraux.

import type {
  BooleanField,
  DateField,
  Definition,
  EnumField,
  EnumOption,
  ImageField,
  ListField,
  NumberField,
  RefField,
  RepeaterField,
  RichTextField,
  TextField,
} from './types.js';

// Options d'un builder = son descripteur privé de `kind` (dérivé, pas de duplication).
type Options<T extends { kind: string }> = Omit<T, 'kind'>;

// Construction générique d'un descripteur. Cette fonction concentre l'UNIQUE assertion interne du
// module : TypeScript ne peut pas prouver que `{ kind, ...options }` (options optionnelles) produit
// `{ kind: K } & O`, alors que c'est vrai par construction (O est inféré des options réelles). Même
// nature que `asSections` : assertion de frontière côté lib, jamais du cast métier.
const make = <K extends string, const O extends object = object>(
  kind: K,
  options?: O,
): { kind: K } & O => ({ kind, ...options }) as { kind: K } & O;

export const field = {
  text<const O extends Options<TextField> = object>(options?: O): { kind: 'text' } & O {
    return make('text', options);
  },

  richText<const O extends Options<RichTextField> = object>(options?: O): { kind: 'richText' } & O {
    return make('richText', options);
  },

  number<const O extends Options<NumberField> = object>(options?: O): { kind: 'number' } & O {
    return make('number', options);
  },

  boolean<const O extends Options<BooleanField> = object>(options?: O): { kind: 'boolean' } & O {
    return make('boolean', options);
  },

  date<const O extends Options<DateField> = object>(options?: O): { kind: 'date' } & O {
    return make('date', options);
  },

  enum<const O extends Options<EnumField>>(options: O): { kind: 'enum' } & O {
    return make('enum', options);
  },

  image<const O extends Options<ImageField> = object>(options?: O): { kind: 'image' } & O {
    return make('image', options);
  },

  ref<const O extends Options<RefField>>(options: O): { kind: 'ref' } & O {
    return make('ref', options);
  },

  // `list(of)` répète un type nommé (component). `of` est passé par référence pour l'auto-collecte
  // ET l'inférence (`InferData<of>[]`).
  list<const D extends Definition, const O extends Omit<Options<ListField>, 'of'> = object>(
    of: D,
    options?: O,
  ): { kind: 'list'; of: D } & O {
    // Même assertion interne que `make` (cf. plus haut) : la fusion de `of` empêche de router par
    // `make`, on construit donc directement le descripteur `list`.
    return { kind: 'list', of, ...options } as { kind: 'list'; of: D } & O;
  },

  repeater<const O extends Options<RepeaterField>>(options: O): { kind: 'repeater' } & O {
    return make('repeater', options);
  },
};

// Alias court validé avec l'utilisateur : `import { field as f } from '@mrcasquette/content'`.
export type Field = typeof field;

// Réexport pratique pour construire des options d'enum en forme longue.
export type { EnumOption };
