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
  ComponentField,
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

// Construction générique d'un descripteur. `Object.assign` est ici un choix de TYPE, pas de style :
// sa signature produit nativement l'intersection `{ kind: K } & O`, là où un littéral à spread
// oblige à affirmer le résultat. Le compilateur prouve ce qu'on affirmait auparavant.
const make = <K extends string, const O extends object = object>(
  kind: K,
  options?: O,
): { kind: K } & O => Object.assign({ kind }, options);

/**
 * Les deux fabriques qui PORTENT UN TYPE dans leur retour — `of: D` — se déclarent ici, en dehors du
 * littéral, parce qu'un littéral d'objet n'admet pas de surcharges. Et il leur en faut.
 *
 * Un paramètre de type optionnel (`const O … = object`) ne prend PAS son défaut quand l'argument est
 * omis : il prend le type CONTEXTUEL de l'appel. En position de champ, ce contexte est `Fields`,
 * donc `ComponentField` / `ListField`, dont le `of: Definition` LARGE s'intersecte avec le `of`
 * littéral et l'écrase. `f.component(inner)` rendait alors facultatifs les champs requis de `inner`,
 * là où `f.component(inner, {})` restait juste — un piège d'autant plus mauvais que la forme fautive
 * est la plus naturelle à écrire.
 *
 * Sans second paramètre de type, la surcharge sans options ne produit aucune intersection : il n'y a
 * plus rien à contaminer. Les autres fabriques gardent leur défaut sans risque — leur descripteur ne
 * porte aucun type à préserver, et l'intersection avec lui-même est inoffensive.
 */
function component<const D extends Definition>(of: D): { kind: 'component'; of: D };
function component<const D extends Definition, const O extends Omit<Options<ComponentField>, 'of'>>(
  of: D,
  options: O,
): { kind: 'component'; of: D } & O;
function component<const D extends Definition>(
  of: D,
  options?: object,
): { kind: 'component'; of: D } {
  return Object.assign({ kind: 'component' as const, of }, options);
}

function list<const D extends Definition>(of: D): { kind: 'list'; of: D };
function list<const D extends Definition, const O extends Omit<Options<ListField>, 'of'>>(
  of: D,
  options: O,
): { kind: 'list'; of: D } & O;
function list<const D extends Definition>(of: D, options?: object): { kind: 'list'; of: D } {
  // La fusion de `of` empêche de router par `make` ; même mécanique d'intersection, appliquée
  // directement.
  return Object.assign({ kind: 'list' as const, of }, options);
}

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

  // `component(of)` imbrique un type nommé à un seul exemplaire. Écrire la Definition NUE
  // (`cta: link`) reste valide et produit la même donnée ; ce builder existe pour porter la méta
  // d'usage — `required` en premier lieu —, qu'une Definition ne peut pas loger (ADR-0075).
  component,

  // `list(of)` répète un type nommé (component). `of` est passé par référence pour l'auto-collecte
  // ET l'inférence (`InferData<of>[]`).
  list,

  repeater<const O extends Options<RepeaterField>>(options: O): { kind: 'repeater' } & O {
    return make('repeater', options);
  },
};

// Alias court validé avec l'utilisateur : `import { field as f } from '@axiome-apps/atelier-content'`.
export type Field = typeof field;

// Réexport pratique pour construire des options d'enum en forme longue.
export type { EnumOption };
