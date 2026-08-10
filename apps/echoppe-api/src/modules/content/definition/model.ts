import { type Static, t } from 'elysia';

// Modèles du REGISTRE de définitions (ADR-0043).
//
// Une `definition` est une entrée du registre : un schema nommé, de rôle `section` ou `component`,
// déclaré par le dev via `@mrcasquette/content` et poussé en base par `PUT /content/registry`.
// Ce fichier décrit la GRAMMAIRE de ce qui entre — la frontière de validation de cette route — et
// les types (`Static`) qu'en dérive le validateur générique (./service.ts).
//
// Vocabulaire : voir docs-internal/reference/lexique-prisme.md, ratifié par ADR-0043.

// ── Registre : grammaire des champs sérialisés (miroir de @mrcasquette/content) ───────────────────
// Méta commune à tout champ.
const fieldMeta = {
  label: t.Optional(t.String()),
  hint: t.Optional(t.String()),
  required: t.Optional(t.Boolean()),
};

// Cible d'un champ `ref` : un NOM de cible inscrite au registre de références, pas une union
// fermée (ADR-0032). Le socle ne connaît pas les entités du produit ; l'existence de la cible se
// vérifie à la synchronisation du registre, pas dans la grammaire (cf. definition/service.ts).
const refTarget = t.String({ minLength: 1 });

// Un champ du registre. Récursif : `repeater` contient lui-même un dictionnaire de champs.
const serializedFieldSchema = t.Recursive((self) =>
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
      fields: t.Record(t.String(), self),
      min: t.Optional(t.Number()),
      max: t.Optional(t.Number()),
    }),
  ]),
);

const serializedDefinitionSchema = t.Object({
  name: t.String(),
  label: t.Optional(t.String()),
  icon: t.Optional(t.String()),
  fields: t.Record(t.String(), serializedFieldSchema),
});

// Corps du `PUT /content/registry` : le registre complet sérialisé par la CLI @mrcasquette/content.
export const registrySchema = t.Object({
  version: t.Literal(1),
  sections: t.Record(t.String(), serializedDefinitionSchema),
  components: t.Record(t.String(), serializedDefinitionSchema),
});

export type SerializedField = Static<typeof serializedFieldSchema>;
export type SerializedDefinition = Static<typeof serializedDefinitionSchema>;
export type Registry = Static<typeof registrySchema>;
