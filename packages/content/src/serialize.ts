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
  name: string,
  value: FieldValue,
  registry: Registry,
  registered: Map<string, Definition>,
): SerializedField {
  // Component imbriqué by-reference (ex. `cta: link`) → ref par nom + auto-collecte.
  if (value.kind === 'definition') {
    collectComponent(value, registry, registered);
    return { name, kind: 'component', of: value.name };
  }

  switch (value.kind) {
    case 'enum':
      return {
        name,
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
        name,
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
        name,
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
      // Primitives, image, ref : le descripteur est déjà la forme JSON du registre, au nom près.
      return { name, ...value };
  }
}

/**
 * POINT DE CAPTURE UNIQUE DE L'ORDRE — INVARIANT (ADR-0049).
 *
 * C'est ici, et nulle part ailleurs, que l'ordre écrit par le dev dans son fichier TS est figé.
 * `Object.entries` le lit une fois ; passé cette ligne, l'ordre vit dans la SÉQUENCE du tableau,
 * qui le porte jusqu'au bout — HTTP, `jsonb`, relecture.
 *
 * Aucun consommateur en aval ne doit reconstruire d'objet indexé par nom : la règle d'énumération
 * de JavaScript (les clés numériques d'abord, `{ '2024': … }` saute en tête) réintroduirait le bug
 * silencieusement, hors de portée du stockage. Un test le verrouille avec un champ nommé `2024`.
 */
function serializeFields(
  fields: Definition['fields'],
  registry: Registry,
  registered: Map<string, Definition>,
): SerializedField[] {
  return Object.entries(fields).map(([name, value]) =>
    serializeField(name, value, registry, registered),
  );
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
      // `link` n'est posé que s'il est déclaré : une entité qui ne se cite pas doit pousser
      // exactement le JSON qu'elle poussait avant ADR-0046, sinon `content:check` se dirait
      // désynchronisé sans qu'un seul fichier ait changé.
      entities[entity.name] = {
        ...serializeDefinition(entity, registry, registered),
        singleton: entity.singleton ?? false,
        ...(entity.link ? { link: entity.link } : {}),
      };
    }
    registry.entities = entities;
  }

  return registry;
}
