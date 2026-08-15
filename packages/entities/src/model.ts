import { serializedFieldSchema } from '@repo/pages';
import { type Static, t } from 'elysia';

// Grammaire de ce qui entre par le push d'entités — la frontière de validation de cette route.
//
// La grammaire des CHAMPS vient de `@repo/pages` plutôt que d'être réécrite ici : une entité et
// une section décrivent leurs champs de la même façon, c'est le point qu'ADR-0026 désigne comme
// « partagé intégralement ». La dépendance se lit à l'envers du bon sens — les champs ne sont pas
// une affaire de pages — et c'est un héritage de l'ordre d'extraction, pas une intention. Cf. #35.

/**
 * Comment l'entité produit son lien (ADR-0032, résolu par ADR-0046).
 *
 * `href` et `anchor` nomment un CHAMP de l'entité. La cohérence de ce nom avec les champs déclarés
 * ne se dit pas ici — une grammaire ne sait pas qu'un champ existe — mais au push, comme
 * `unknownRefTargets` vérifie qu'une cible citée est inscrite.
 */
export const entityLinkSchema = t.Union([
  t.Object({ mode: t.Literal('route'), route: t.String({ minLength: 1 }) }),
  t.Object({ mode: t.Literal('href'), field: t.String({ minLength: 1 }) }),
  t.Object({ mode: t.Literal('anchor'), parent: t.String({ minLength: 1 }) }),
]);

export const entityDeclarationSchema = t.Object({
  name: t.String({ minLength: 1 }),
  label: t.Optional(t.String()),
  icon: t.Optional(t.String()),
  singleton: t.Boolean(),
  // Absent = entité non référençable, ce qui est un état normal (ADR-0032) : ce qui rend une
  // entité citable est d'avoir une URL, pas d'être déclarée.
  link: t.Optional(entityLinkSchema),
  // SÉQUENCE, pas dictionnaire (ADR-0049) — c'est aussi l'ordre des colonnes dérivées.
  fields: t.Array(serializedFieldSchema),
});

export const entityRegistrySchema = t.Record(t.String(), entityDeclarationSchema);

export type EntityLink = Static<typeof entityLinkSchema>;
export type EntityDeclaration = Static<typeof entityDeclarationSchema>;
export type EntityRegistry = Static<typeof entityRegistrySchema>;
