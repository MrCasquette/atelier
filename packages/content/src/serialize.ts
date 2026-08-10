// Compilation d'une `ContentDefinition` (authoring, références par objet) vers le `Registry`
// JSON (références par nom). C'est ce registre qui est poussé vers l'API (P2b) et lu par le
// générateur de formulaires admin (P3). Le typage du front, lui, ne passe PAS par ici : il est
// inféré directement des déclarations (cf. `InferData`/`InferSections`, types.ts).
//
// En marchant les sections, les components référencés (champ imbriqué `cta: link`, ou
// `f.list(card)`) sont AUTO-COLLECTÉS dans `registry.components`. Deux garde-fous :
//   - collision de nom : deux définitions distinctes sous le même nom → erreur explicite.
//   - cycle : un component qui se référence (directement ou non) ne boucle pas — on enregistre
//     le nom AVANT de sérialiser ses champs, la ré-rencontre s'arrête sur l'identité déjà vue.
//
// C'est aussi ici qu'a lieu la NORMALISATION des options d'enum (`string` → `{ value, label }`) :
// l'authoring garde les littéraux (pour l'inférence), le registre est canonique.

import type {
  ContentDefinition,
  Definition,
  Entity,
  EnumOption,
  FieldValue,
  Registry,
  SerializedDefinition,
  SerializedEntity,
  SerializedField,
} from './types.js';

const collision = (name: string): Error =>
  new Error(
    `Collision de nom « ${name} » : deux définitions distinctes portent le même nom. Chaque component/section doit avoir un nom unique.`,
  );

const normalizeEnumOptions = (options: ReadonlyArray<string | EnumOption>): EnumOption[] =>
  options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));

function serializeField(
  value: FieldValue,
  registry: Registry,
  registered: Map<string, Definition>,
): SerializedField {
  // Component imbriqué by-reference (ex. `cta: link`) → ref par nom + auto-collecte.
  if (value.kind === 'definition') {
    collectComponent(value, registry, registered);
    return { kind: 'component', of: value.name };
  }

  switch (value.kind) {
    case 'enum':
      return {
        kind: 'enum',
        options: normalizeEnumOptions(value.options),
        multiple: value.multiple,
        label: value.label,
        hint: value.hint,
        required: value.required,
        default: value.default,
      };
    case 'list': {
      collectComponent(value.of, registry, registered);
      return {
        kind: 'list',
        of: value.of.name,
        label: value.label,
        hint: value.hint,
        required: value.required,
        min: value.min,
        max: value.max,
      };
    }
    case 'repeater': {
      return {
        kind: 'repeater',
        fields: serializeFields(value.fields, registry, registered),
        label: value.label,
        hint: value.hint,
        required: value.required,
        min: value.min,
        max: value.max,
      };
    }
    default:
      // Primitives, image, ref : le descripteur est déjà la forme JSON du registre.
      return value;
  }
}

function serializeFields(
  fields: Definition['fields'],
  registry: Registry,
  registered: Map<string, Definition>,
): Record<string, SerializedField> {
  const out: Record<string, SerializedField> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = serializeField(value, registry, registered);
  }
  return out;
}

function serializeDefinition(
  def: Definition | Entity,
  registry: Registry,
  registered: Map<string, Definition>,
): SerializedDefinition {
  return {
    name: def.name,
    label: def.label,
    icon: def.icon,
    fields: serializeFields(def.fields, registry, registered),
  };
}

function collectComponent(
  def: Definition,
  registry: Registry,
  registered: Map<string, Definition>,
): void {
  const existing = registered.get(def.name);
  if (existing) {
    if (existing !== def) {
      throw collision(def.name);
    }
    return; // déjà collecté — coupe les cycles
  }
  registered.set(def.name, def);
  registry.components[def.name] = serializeDefinition(def, registry, registered);
}

// Compile la racine `defineContent` en registre JSON.
export function serialize(content: ContentDefinition): Registry {
  const registry: Registry = { version: 1, sections: {}, components: {} };
  const registered = new Map<string, Definition>();

  for (const section of content.sections) {
    const existing = registered.get(section.name);
    if (existing && existing !== section) {
      throw collision(section.name);
    }
    registered.set(section.name, section);
    registry.sections[section.name] = serializeDefinition(section, registry, registered);
  }

  // Les entités ont leur PROPRE espace de noms — elles ne partagent pas la table des sections et
  // components (cf. types.ts). Leur collision se vérifie donc entre elles seules, sur le registre
  // plutôt que sur `registered`. Leurs champs, en revanche, alimentent la même auto-collecte de
  // components : un `f.list(card)` dans une entité inscrit `card` comme n'importe où ailleurs.
  // Clé omise quand il n'y a aucune entité (cf. types.ts) : un dépôt qui n'en déclare pas pousse
  // le même JSON qu'avant leur existence.
  if (content.entities.length > 0) {
    const entities: Record<string, SerializedEntity> = {};
    for (const entity of content.entities) {
      if (entities[entity.name]) {
        throw collision(entity.name);
      }
      entities[entity.name] = {
        ...serializeDefinition(entity, registry, registered),
        singleton: entity.singleton ?? false,
      };
    }
    registry.entities = entities;
  }

  return registry;
}
