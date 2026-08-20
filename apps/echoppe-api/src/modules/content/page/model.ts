import { t } from 'elysia';

// Modèles du page builder (ADR-0043).
//
// Deux rôles : le CONTRAT de lecture storefront (page + section générique) et le corps d'écriture
// des sections côté admin. La forme d'un bloc n'est PAS codée ici — elle vit dans le registre de
// définitions (`@repo/pages`) et la validation fine de `data` se fait à l'exécution
// contre lui, pas par une union statique.
//
// Vocabulaire : voir docs-internal/glossaire.md, ratifié par ADR-0043.

const uuidStr = (description: string) => t.String({ format: 'uuid', description });
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
export const pageModels = {
  Section: sectionSchema,
  Page: pageSchema,
  PageList: t.Array(pageSummarySchema),
};
