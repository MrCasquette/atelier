// Helpers purs du registre : valeurs initiales des champs + clé d'injection du registre.
// Pas de logique métier dans les composants → l'init d'un bloc/item vit ici.
import type { InjectionKey } from 'vue';
import type { BlockData, Registry, SerializedDefinition, SerializedField } from './types';

// Le registre (résolution des `component`/`list` par nom) est fourni en haut de l'éditeur et
// injecté par la récursion DynamicForm → FieldControl → DynamicForm imbriqué.
export const registryKey: InjectionKey<Registry> = Symbol('content-registry');

// Valeur initiale d'un champ, à la création d'un bloc ou d'un item de liste/repeater.
export function emptyValue(field: SerializedField, registry: Registry): unknown {
  switch (field.kind) {
    case 'text':
    case 'richText':
    case 'date':
      return field.default ?? '';
    case 'number':
      return field.default ?? null;
    case 'boolean':
      return field.default ?? false;
    case 'enum':
      return field.default ?? (field.multiple ? [] : '');
    case 'image':
    case 'ref':
      return null;
    case 'component': {
      const def = registry.components[field.of];
      return def ? emptyData(def, registry) : {};
    }
    case 'list':
    case 'repeater':
      return [];
  }
}

// Donnée vide d'une map de champs (définition, ou groupe repeater/list imbriqué).
export function emptyFieldsData(
  fields: Record<string, SerializedField>,
  registry: Registry,
): BlockData {
  const data: BlockData = {};
  for (const [name, field] of Object.entries(fields)) {
    data[name] = emptyValue(field, registry);
  }
  return data;
}

// Donnée vide d'une définition : valeur initiale de chacun de ses champs.
export function emptyData(def: SerializedDefinition, registry: Registry): BlockData {
  return emptyFieldsData(def.fields, registry);
}

// ── Sérialisation à la frontière (pruning des vides) ──────────────────────────────────────────
// Le serveur valide `date`/`image`/`ref` par format (Date.parse / uuid) : envoyer `''` pour un
// champ vide échouerait. On omet donc les valeurs vides avant le PUT — un champ requis vide devient
// une clé absente, ce que le validateur registre (objet TypeBox à clés requises) signale en 422.
const OMIT = Symbol('omit');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function pruneValue(field: SerializedField, value: unknown, registry: Registry): unknown {
  switch (field.kind) {
    case 'text':
    case 'richText':
    case 'date':
    case 'image':
    case 'ref':
      return typeof value === 'string' && value !== '' ? value : OMIT;
    case 'number':
      return typeof value === 'number' ? value : OMIT;
    case 'boolean':
      return typeof value === 'boolean' ? value : false;
    case 'enum':
      if (field.multiple) return Array.isArray(value) && value.length > 0 ? value : OMIT;
      return typeof value === 'string' && value !== '' ? value : OMIT;
    case 'component': {
      const def = registry.components[field.of];
      return def ? pruneFields(def.fields, asRecord(value), registry) : OMIT;
    }
    case 'list': {
      const def = registry.components[field.of];
      if (!def || !Array.isArray(value)) return OMIT;
      const items = value.map((item) => pruneFields(def.fields, asRecord(item), registry));
      return items.length > 0 ? items : OMIT;
    }
    case 'repeater': {
      if (!Array.isArray(value)) return OMIT;
      const items = value.map((item) => pruneFields(field.fields, asRecord(item), registry));
      return items.length > 0 ? items : OMIT;
    }
  }
}

// Applique le pruning à un dictionnaire de champs (définition ou groupe repeater imbriqué).
export function pruneFields(
  fields: Record<string, SerializedField>,
  data: Record<string, unknown>,
  registry: Registry,
): BlockData {
  const out: BlockData = {};
  for (const [name, field] of Object.entries(fields)) {
    const pruned = pruneValue(field, data[name], registry);
    if (pruned !== OMIT) out[name] = pruned;
  }
  return out;
}
