import { serializedFieldSchema } from '@repo/fields';
import { type Static, t } from 'elysia';

// Modèles du REGISTRE de définitions (ADR-0043).
//
// Une `definition` est une entrée du registre : un schema nommé, de rôle `section` ou `component`,
// déclaré par le dev via `@mrcasquette/content` et poussé en base par `PUT /content/registry`.
// Ce fichier décrit la frontière de validation de cette route.
//
// La grammaire des CHAMPS vient de `@repo/fields` : une section et une entité la partagent
// intégralement (ADR-0026, #35). Ce qui est propre au registre — le rôle `section`/`component`, le
// versionnage, le stockage — reste ici.

const serializedDefinitionSchema = t.Object({
  name: t.String(),
  label: t.Optional(t.String()),
  icon: t.Optional(t.String()),
  // SÉQUENCE, pas dictionnaire : la position porte l'ordre déclaré (ADR-0049). L'unicité des noms
  // était gratuite avec un objet ; elle est désormais une garde explicite (`assertRegistryCoherent`).
  fields: t.Array(serializedFieldSchema),
});

// Corps du `PUT /content/registry` : le registre complet sérialisé par la CLI @mrcasquette/content.
export const registrySchema = t.Object({
  version: t.Literal(1),
  sections: t.Record(t.String(), serializedDefinitionSchema),
  components: t.Record(t.String(), serializedDefinitionSchema),
});

// `SerializedField` est déclaré plus haut — c'est l'adaptateur statique, pas un `Static<>`.
export type SerializedDefinition = Static<typeof serializedDefinitionSchema>;
export type Registry = Static<typeof registrySchema>;
