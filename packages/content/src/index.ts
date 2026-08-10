// Surface publique de `@mrcasquette/content` — l'outillage build/dev-time de déclaration de contenu.
// Importé en devDependency du repo front du dev. Ne fait AUCUN appel runtime : il déclare, la CLI
// sérialise vers le registre de l'API (P2b) et le front INFÈRE ses types depuis la déclaration (P2c,
// `InferData`/`InferSections`) — pas de codegen, le registre poussé ne sert qu'à l'admin.

export type { ContentConfig, DefinitionConfig, EntityConfig } from './define.js';
export { defineComponent, defineContent, defineEntity, defineSection } from './define.js';
export type { EnumOption, Field } from './field.js';
export { field, field as f } from './field.js';
export { link } from './link.js';
export type { RawSection } from './narrow.js';
export { asSections } from './narrow.js';
export { serialize } from './serialize.js';
export type { CheckResult, PushOptions, PushResult } from './sync.js';
export { checkRegistry, pushRegistry } from './sync.js';
export type {
  BooleanField,
  ContentDefinition,
  DateField,
  Definition,
  DefinitionRole,
  Entity,
  EnumField,
  Fields,
  ImageField,
  InferData,
  InferEntity,
  InferSections,
  ListField,
  NumberField,
  RefField,
  RefTarget,
  Registry,
  RepeaterField,
  RichTextField,
  SerializedDefinition,
  SerializedEntity,
  SerializedField,
  TextField,
} from './types.js';
