import { t } from 'elysia';

// Ce qu'un champ EST — la forme sérialisée, miroir du DSL de `@mrcasquette/content`.
// Charte du paquet et frontière : `index.ts`.

// ── Méta commune à tout champ ─────────────────────────────────────────────────────────────────
//
// `name` en fait partie : un champ PORTE son nom, il n'est plus la clé d'un dictionnaire
// (ADR-0049). L'ordre de déclaration est une information métier — c'est l'ordre du formulaire
// d'administration — et aucune construction à clés ne le garantit : ni `jsonb`, qui trie les clés
// d'objet, ni JavaScript, qui énumère les clés numériques en tête. La séquence, elle, le porte.
//
// Le nom commence par une LETTRE, et ce n'est pas cosmétique. Les champs s'écrivent dans un objet
// littéral côté DSL, et JavaScript énumère les clés qui ressemblent à un index de tableau EN TÊTE :
// `{ titre, '2024', corps, '7' }` sort `7, 2024, titre, corps`. Le brouillage a lieu à l'écriture,
// hors de portée de la sérialisation comme du stockage — on refuse donc le cas plutôt que de
// promettre un ordre qu'on ne tiendrait pas. Le DSL refuse déjà au dev (`assertFieldNames`) ; ici
// c'est la frontière, et une clé d'API pousse ce qu'elle veut.
const fieldMeta = {
  name: t.String({ pattern: '^[a-zA-Z][a-zA-Z0-9_]*$' }),
  label: t.Optional(t.String()),
  hint: t.Optional(t.String()),
  required: t.Optional(t.Boolean()),
};

// Cible d'un champ `ref` : un NOM de cible inscrite au registre de références, pas une union
// fermée (ADR-0032). Le socle ne connaît pas les entités du produit ; l'existence de la cible se
// vérifie à la synchronisation du registre, pas dans la grammaire (cf. `@repo/pages`,
// `definition-service.ts`).
const refTarget = t.String({ minLength: 1 });

// Un champ du registre. Récursif : `repeater` contient lui-même une séquence de champs.
//
// ⚠️ Ce schéma n'est PAS exporté tel quel — cf. `serializedFieldSchema` plus bas et l'adaptateur
// statique qui l'accompagne. Il reste la SEULE chose qui valide au runtime.
export const serializedFieldShape = t.Recursive((self) =>
  t.Union([
    t.Object({
      ...fieldMeta,
      kind: t.Literal('text'),
      placeholder: t.Optional(t.String()),
      default: t.Optional(t.String()),
      minLength: t.Optional(t.Number()),
      maxLength: t.Optional(t.Number()),
      format: t.Optional(t.String()),
    }),
    t.Object({
      ...fieldMeta,
      kind: t.Literal('richText'),
      placeholder: t.Optional(t.String()),
      default: t.Optional(t.String()),
    }),
    t.Object({
      ...fieldMeta,
      kind: t.Literal('number'),
      placeholder: t.Optional(t.String()),
      default: t.Optional(t.Number()),
      integer: t.Optional(t.Boolean()),
      min: t.Optional(t.Number()),
      max: t.Optional(t.Number()),
    }),
    t.Object({ ...fieldMeta, kind: t.Literal('boolean'), default: t.Optional(t.Boolean()) }),
    t.Object({
      ...fieldMeta,
      kind: t.Literal('date'),
      default: t.Optional(t.String()),
      time: t.Optional(t.Boolean()),
    }),
    t.Object({
      ...fieldMeta,
      kind: t.Literal('enum'),
      options: t.Array(t.Object({ value: t.String(), label: t.String() })),
      multiple: t.Optional(t.Boolean()),
      default: t.Optional(t.Union([t.String(), t.Array(t.String())])),
    }),
    t.Object({ ...fieldMeta, kind: t.Literal('image') }),
    t.Object({ ...fieldMeta, kind: t.Literal('ref'), to: refTarget }),
    t.Object({ ...fieldMeta, kind: t.Literal('component'), of: t.String() }),
    t.Object({
      ...fieldMeta,
      kind: t.Literal('list'),
      of: t.String(),
      min: t.Optional(t.Number()),
      max: t.Optional(t.Number()),
    }),
    t.Object({
      ...fieldMeta,
      kind: t.Literal('repeater'),
      fields: t.Array(self),
      min: t.Optional(t.Number()),
      max: t.Optional(t.Number()),
    }),
  ]),
);

// ── Adaptateur statique — CONTOURNEMENT ELYSIA, pas un modèle ─────────────────────────────────
//
// Ce qui suit décrit en TypeScript ce que `serializedFieldShape` décrit en TypeBox. C'est une
// duplication, et elle est assumée pour une raison précise et bornée :
//
// Depuis qu'une définition porte une SÉQUENCE de champs (ADR-0049), `Static<>` du schéma récursif
// traverse un `t.Array`. TypeScript n'arrive alors plus à prouver que ce type est égal à lui-même
// à travers les génériques de route d'Elysia — la comparaison d'un élément de tableau est avide, là
// où l'index signature d'un `t.Record` la différait. Trois routes cessaient de compiler
// (`/content/registry`, `/content/entities`, `/content/entities/mine`) alors que le type était
// assignable en direct. Ni le nommage du modèle, ni l'annotation du handler n'y changent rien :
// vérifié, un par un.
//
// `t.Unsafe` est l'échappatoire prévue par TypeBox pour ça. Le mot inquiète à tort : on lui passe le
// VRAI schéma récursif, donc la validation runtime et le schéma OpenAPI émis sont identiques au
// caractère près (comparés en JSON). On dit seulement à TypeScript d'arrêter d'inférer et de lire
// ce type-ci.
//
// CE BLOC DISPARAÎT le jour où l'inférence récursive d'Elysia encaisse un tableau : il suffira
// d'exporter `serializedFieldShape` directement et de supprimer ces lignes avec leur verrou.
// Le verrou, justement, vit dans `model.test.ts` — la duplication n'est tolérable que parce
// qu'une dérive y échoue à la compilation.

type FieldMeta = {
  name: string;
  label?: string;
  hint?: string;
  required?: boolean;
};

export type SerializedField =
  | (FieldMeta & {
      kind: 'text';
      placeholder?: string;
      default?: string;
      minLength?: number;
      maxLength?: number;
      format?: string;
    })
  | (FieldMeta & { kind: 'richText'; placeholder?: string; default?: string })
  | (FieldMeta & {
      kind: 'number';
      placeholder?: string;
      default?: number;
      integer?: boolean;
      min?: number;
      max?: number;
    })
  | (FieldMeta & { kind: 'boolean'; default?: boolean })
  | (FieldMeta & { kind: 'date'; default?: string; time?: boolean })
  | (FieldMeta & {
      kind: 'enum';
      options: { value: string; label: string }[];
      multiple?: boolean;
      default?: string | string[];
    })
  | (FieldMeta & { kind: 'image' })
  | (FieldMeta & { kind: 'ref'; to: string })
  | (FieldMeta & { kind: 'component'; of: string })
  | (FieldMeta & { kind: 'list'; of: string; min?: number; max?: number })
  | (FieldMeta & { kind: 'repeater'; fields: SerializedField[]; min?: number; max?: number });

/** Le schéma tel que le reste du monde l'emploie : même validation, type statique lisible. */
export const serializedFieldSchema = t.Unsafe<SerializedField>(serializedFieldShape);
