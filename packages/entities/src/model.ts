import { serializedFieldSchema } from '@repo/pages';
import { type Static, t } from 'elysia';

// Grammaire de ce qui entre par le push d'entités — la frontière de validation de cette route.
//
// La grammaire des CHAMPS vient de `@repo/pages` plutôt que d'être réécrite ici : une entité et
// une section décrivent leurs champs de la même façon, c'est le point qu'ADR-0026 désigne comme
// « partagé intégralement ». La dépendance se lit à l'envers du bon sens — les champs ne sont pas
// une affaire de pages — et c'est un héritage de l'ordre d'extraction, pas une intention. Cf. #35.

export const entityDeclarationSchema = t.Object({
  name: t.String({ minLength: 1 }),
  label: t.Optional(t.String()),
  icon: t.Optional(t.String()),
  singleton: t.Boolean(),
  fields: t.Record(t.String(), serializedFieldSchema),
});

export const entityRegistrySchema = t.Record(t.String(), entityDeclarationSchema);

export type EntityDeclaration = Static<typeof entityDeclarationSchema>;
export type EntityRegistry = Static<typeof entityRegistrySchema>;
