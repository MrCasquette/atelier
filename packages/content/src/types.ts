// Représentation interne des définitions de contenu (descripteurs). Ces objets sont produits par
// les builders `field`/`f` et par `defineComponent`/`defineSection`, puis sérialisés en JSON
// (registre) par `serialize.ts`. Aucune logique ici — uniquement des formes de données + les
// utilitaires d'INFÉRENCE de types (P2c) qui dérivent, à la compilation, le type de la donnée
// éditée à partir des descripteurs. Le front n'a donc PAS de codegen : il infère depuis sa propre
// déclaration (`InferData` / `InferSections`), le registre poussé ne sert qu'à l'admin.
//
// Deux mondes :
//   - AUTHORING (ce fichier, en haut) : descripteurs riches manipulés dans le repo du dev. Les
//     champs `list`/composant imbriqué portent la Definition **par référence** (l'objet), ce qui
//     permet l'auto-collecte des components ET l'inférence de type.
//   - REGISTRE (en bas) : forme JSON sérialisable, références résolues **par nom** — c'est ce qui
//     est poussé vers l'API (P2b) et lu par l'admin (P3).

// ── Champs : options méta communes (contraintes d'édition + libellés admin) ──────────────────
export interface FieldMeta {
  label?: string;
  hint?: string;
  required?: boolean;
}

// ── Champs primitifs ─────────────────────────────────────────────────────────────────────────
export interface TextField extends FieldMeta {
  kind: 'text';
  placeholder?: string;
  default?: string;
  minLength?: number;
  maxLength?: number;
  format?: string;
}

export interface RichTextField extends FieldMeta {
  kind: 'richText'; // stockage Markdown
  placeholder?: string;
  default?: string;
}

export interface NumberField extends FieldMeta {
  kind: 'number';
  placeholder?: string;
  default?: number;
  integer?: boolean;
  min?: number;
  max?: number;
}

export interface BooleanField extends FieldMeta {
  kind: 'boolean';
  default?: boolean;
}

export interface DateField extends FieldMeta {
  kind: 'date'; // stockage ISO 8601
  default?: string;
  time?: boolean; // inclure l'heure (datetime) plutôt que la date seule
}

export interface EnumOption {
  value: string;
  label: string;
}

// Options d'un enum en AUTHORING : raccourci `string[]` (value === label) OU `{ value, label }`.
// La normalisation vers `{ value, label }` a lieu à la SÉRIALISATION (registre canonique), pas au
// build — ainsi le type authoring conserve les littéraux pour l'inférence.
export interface EnumField extends FieldMeta {
  kind: 'enum';
  options: ReadonlyArray<string | EnumOption>;
  multiple?: boolean;
  default?: string | string[];
}

// ── Champs fonctionnels ──────────────────────────────────────────────────────────────────────
/**
 * Cible d'un champ `ref` : le NOM d'une entité référençable inscrite côté API (ADR-0032).
 *
 * C'était `'product' | 'collection' | 'category'` — le vocabulaire de l'e-commerce écrit dans un
 * paquet que tout produit consomme. Un CMS n'a pas de produits ; un dev qui référence ses propres
 * entités n'avait aucun moyen de le dire.
 *
 * Le nom est libre ici et vérifié à la synchronisation : `pushRegistry` refuse une cible que l'API
 * ne connaît pas, en nommant le champ fautif. Un nom inconnu est donc une erreur de push, pas un
 * échec au type-check.
 */
export type RefTarget = string;

export interface ImageField extends FieldMeta {
  kind: 'image'; // UUID de média, résolu au read côté API (brut en V1)
}

export interface RefField extends FieldMeta {
  kind: 'ref'; // référence catalogue, résolue au read en projection d'entité (UUID brut en V1)
  to: RefTarget;
}

// `list` répète un TYPE NOMMÉ (component) — by-reference en authoring, by-name au registre.
export interface ListField extends FieldMeta {
  kind: 'list';
  of: Definition;
  min?: number;
  max?: number;
}

// `repeater` répète un GROUPE INLINE anonyme — imbricable à la main (repeater dans repeater).
export interface RepeaterField extends FieldMeta {
  kind: 'repeater';
  fields: Fields;
  min?: number;
  max?: number;
}

export type FieldNode =
  | TextField
  | RichTextField
  | NumberField
  | BooleanField
  | DateField
  | EnumField
  | ImageField
  | RefField
  | ListField
  | RepeaterField;

// Une valeur de champ : soit un champ, soit une Definition (component imbriqué by-reference, ex.
// `cta: link`). On discrimine sur `kind` (`'definition'` vs les kinds de champ).
export type FieldValue = FieldNode | Definition;
export type Fields = Record<string, FieldValue>;

// ── Definitions (components & sections) — même forme, rôle différent ──────────────────────────
export type DefinitionRole = 'section' | 'component';

// Génériques sur les champs `F` et le nom `Name` : capturés littéralement par les builders
// (`const` type params) pour permettre l'inférence. Les défauts erased servent de contrainte.
export interface Definition<F extends Fields = Fields, Name extends string = string> {
  kind: 'definition';
  role: DefinitionRole;
  name: Name;
  label?: string;
  icon?: string;
  fields: F;
}

export interface ContentDefinition<S extends readonly Definition[] = readonly Definition[]> {
  kind: 'content';
  sections: S; // uniquement des définitions de rôle 'section'
}

// ── Inférence de types (P2c) ─────────────────────────────────────────────────────────────────
// Aplatit les intersections pour un hover lisible.
type Prettify<T> = { [K in keyof T]: T[K] } & {};

// Valeurs littérales d'un enum, à partir de ses options authoring (string | { value }).
type EnumValueOf<O> =
  O extends ReadonlyArray<infer Item>
    ? Item extends string
      ? Item
      : Item extends { value: infer V extends string }
        ? V
        : never
    : never;

// Type valeur d'UN champ (ou d'un component imbriqué).
type ValueOf<F> = F extends { kind: 'text' | 'richText' | 'date' | 'image' | 'ref' }
  ? string
  : F extends { kind: 'number' }
    ? number
    : F extends { kind: 'boolean' }
      ? boolean
      : F extends { kind: 'enum'; options: infer O }
        ? F extends { multiple: true }
          ? EnumValueOf<O>[]
          : EnumValueOf<O>
        : F extends { kind: 'list'; of: infer D }
          ? D extends Definition
            ? InferData<D>[]
            : never
          : F extends { kind: 'repeater'; fields: infer FF }
            ? FF extends Fields
              ? Prettify<InferFields<FF>>[]
              : never
            : F extends { kind: 'definition'; fields: infer DF }
              ? DF extends Fields
                ? Prettify<InferFields<DF>>
                : never
              : never;

// Un champ est optionnel dans la donnée sauf s'il est explicitement `required: true`.
type RequiredKeys<F extends Fields> = {
  [K in keyof F]: F[K] extends { required: true } ? K : never;
}[keyof F];

// Objet de champs → forme de la donnée (clés requises vs optionnelles).
type InferFields<F extends Fields> = {
  [K in keyof F as K extends RequiredKeys<F> ? K : never]: ValueOf<F[K]>;
} & {
  [K in keyof F as K extends RequiredKeys<F> ? never : K]?: ValueOf<F[K]>;
};

/** Forme de la donnée éditée d'une section/component. */
export type InferData<D extends Definition> =
  D extends Definition<infer F> ? Prettify<InferFields<F>> : never;

/** Union discriminée `{ id, type, data }` des sections d'un `defineContent`. */
export type InferSections<C extends ContentDefinition> =
  C extends ContentDefinition<infer S>
    ? {
        [I in keyof S]: S[I] extends Definition<infer F, infer N>
          ? { id: string; type: N; data: Prettify<InferFields<F>> }
          : never;
      }[number]
    : never;

// ── Registre sérialisé (JSON) — références par nom ───────────────────────────────────────────
export type SerializedField =
  | TextField
  | RichTextField
  | NumberField
  | BooleanField
  | DateField
  | {
      kind: 'enum';
      options: EnumOption[];
      multiple?: boolean;
      label?: string;
      hint?: string;
      required?: boolean;
      default?: string | string[];
    }
  | ImageField
  | RefField
  | { kind: 'component'; of: string; label?: string; hint?: string; required?: boolean }
  | {
      kind: 'list';
      of: string;
      label?: string;
      hint?: string;
      required?: boolean;
      min?: number;
      max?: number;
    }
  | {
      kind: 'repeater';
      fields: Record<string, SerializedField>;
      label?: string;
      hint?: string;
      required?: boolean;
      min?: number;
      max?: number;
    };

export interface SerializedDefinition {
  name: string;
  label?: string;
  icon?: string;
  fields: Record<string, SerializedField>;
}

export interface Registry {
  version: 1;
  sections: Record<string, SerializedDefinition>;
  components: Record<string, SerializedDefinition>;
}
