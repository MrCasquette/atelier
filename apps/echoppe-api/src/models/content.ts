import { type Static, t } from 'elysia';

// Modèles du module content (page builder).
//
// La forme des blocs n'est PLUS codée en dur ici : elle vit dans le REGISTRE (config-as-code
// déclarée par le dev via `@mrcasquette/content`, synchronisée en DB via `PUT /content/registry`).
// Ce fichier garde deux rôles :
//   1. le CONTRAT de lecture storefront (page / section générique) — inchangé ;
//   2. le schéma du REGISTRE entrant (frontière de validation du `PUT /content/registry`), d'où
//      l'on dérive les types (`Static`) exploités par le validateur générique (services/content).
// La validation fine de `data` par bloc est faite à l'exécution par ce validateur (schéma compilé
// depuis le registre), pas par une union statique.

const uuidStr = (description: string) => t.String({ format: 'uuid', description });

// ── Registre : grammaire des champs sérialisés (miroir de @mrcasquette/content) ───────────────────
// Méta commune à tout champ.
const fieldMeta = {
  label: t.Optional(t.String()),
  hint: t.Optional(t.String()),
  required: t.Optional(t.Boolean()),
};

const refTarget = t.Union([t.Literal('product'), t.Literal('collection'), t.Literal('category')]);

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

// ── Écriture d'une section (admin) ────────────────────────────────────────────────────────────
// Corps GÉNÉRIQUE : `{ name?, type, data }`. `data` n'est pas typé au niveau du contrat (la forme
// dépend du bloc) — il est validé à l'exécution contre le registre (services/content).
export const sectionInputSchema = t.Object({
  name: t.Optional(t.String()),
  type: t.String({ description: 'Type de bloc (doit exister dans le registre).' }),
  data: t.Unknown({ description: 'Champs du bloc — validés contre la définition du registre.' }),
});

// ── Contrat de LECTURE storefront (inchangé) ──────────────────────────────────────────────────
// Section résolue : forme générique `{ id, type, data }`. `data` non typé ici (le typage fin par
// bloc vient du type-gen des définitions, côté front du dev).
const sectionSchema = t.Object({
  id: uuidStr('UUID de la section.'),
  type: t.String({ description: 'Type de bloc (défini dans le registre).' }),
  data: t.Unknown({ description: 'Champs du bloc — forme selon `type`.' }),
});

const pageStatus = t.Union([t.Literal('draft'), t.Literal('published')], {
  description: 'Statut de publication.',
});

// Page complète (storefront) : métadonnées + sections ordonnées et résolues.
export const pageSchema = t.Object({
  id: uuidStr('UUID de la page.'),
  slug: t.String({ description: 'Identifiant lisible pour l’URL.' }),
  title: t.String({ description: 'Titre de la page.' }),
  seoTitle: t.Nullable(t.String({ description: 'Titre SEO, ou null.' })),
  seoDescription: t.Nullable(t.String({ description: 'Meta description SEO, ou null.' })),
  status: pageStatus,
  sections: t.Array(sectionSchema, { description: 'Sections de la page, ordonnées.' }),
});

// Aperçu de page (liste storefront : navigation, plan de site).
const pageSummarySchema = t.Object({
  id: uuidStr('UUID de la page.'),
  slug: t.String({ description: 'Identifiant lisible pour l’URL.' }),
  title: t.String({ description: 'Titre de la page.' }),
});

// Modèles nommés exposés dans le contrat (components.schemas).
export const contentModels = {
  Section: sectionSchema,
  Page: pageSchema,
  PageList: t.Array(pageSummarySchema),
};
