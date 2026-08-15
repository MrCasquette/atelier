import { type TSchema, t } from 'elysia';
import { FormatRegistry, type TypeCheck, TypeCompiler } from 'elysia/type-system';
import type { SerializedField } from './model';

// Ce qu'un champ ACCEPTE : la traduction d'une déclaration en validateur TypeBox compilable.
//
// C'est la moitié partagée de la dérivation. Une entité et une section valident leurs données de la
// même façon, parce qu'elles décrivent leurs champs de la même façon. L'autre moitié — champ →
// colonne SQL — est propre aux entités et reste chez elles (`@repo/entities/ddl.ts`) : même
// déclaration, deux dérivations, l'une dit ce qu'on accepte et l'autre où on le range.
//
// On n'importe QUE depuis Elysia (`t`) et son type-system : même instance TypeBox que le reste de
// l'API, donc aucune version à maintenir et aucune dérive.

// ── Formats (branchés une fois sur l'instance TypeBox d'Elysia) ───────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!FormatRegistry.Has('uuid')) {
  FormatRegistry.Set('uuid', (value) => UUID_RE.test(value));
}
if (!FormatRegistry.Has('date')) {
  FormatRegistry.Set('date', (value) => !Number.isNaN(Date.parse(value)));
}
if (!FormatRegistry.Has('date-time')) {
  FormatRegistry.Set('date-time', (value) => !Number.isNaN(Date.parse(value)));
}

/**
 * De quoi résoudre un `component`/`list` : un dictionnaire de définitions par nom.
 *
 * STRUCTUREL et non importé du registre — la grammaire n'a pas à connaître ce qu'est un registre,
 * ni qui le stocke. L'appelant seul sait charger ses components (#35).
 */
export type Components = Record<string, { fields: readonly SerializedField[] }>;

function resolveComponent(name: string, components: Components, seen: Set<string>): TSchema {
  if (seen.has(name)) {
    throw new Error(`Référence circulaire de component : « ${name} » (non supportée en V1).`);
  }
  const def = components[name];
  if (!def) {
    throw new Error(`Component référencé introuvable dans le registre : « ${name} ».`);
  }
  return fieldsToSchema(def.fields, components, new Set(seen).add(name));
}

function fieldToSchema(field: SerializedField, components: Components, seen: Set<string>): TSchema {
  switch (field.kind) {
    case 'text':
      return t.String({
        minLength: field.minLength,
        maxLength: field.maxLength,
        format: field.format,
      });
    case 'richText':
      return t.String();
    case 'number':
      return field.integer
        ? t.Integer({ minimum: field.min, maximum: field.max })
        : t.Number({ minimum: field.min, maximum: field.max });
    case 'boolean':
      return t.Boolean();
    case 'date':
      return t.String({ format: field.time ? 'date-time' : 'date' });
    case 'enum': {
      const one = t.Union(field.options.map((option) => t.Literal(option.value)));
      return field.multiple ? t.Array(one) : one;
    }
    case 'image':
    case 'ref':
      return t.String({ format: 'uuid' }); // existence vérifiée séparément (accès DB)
    case 'component':
      return resolveComponent(field.of, components, seen);
    case 'list':
      return t.Array(resolveComponent(field.of, components, seen), {
        minItems: field.min,
        maxItems: field.max,
      });
    case 'repeater':
      return t.Array(fieldsToSchema(field.fields, components, seen), {
        minItems: field.min,
        maxItems: field.max,
      });
  }
}

/**
 * Traduit une séquence de champs en schéma d'objet, sans le compiler.
 *
 * La DONNÉE d'une section reste un objet indexé par nom de champ — c'est ce que le front consomme.
 * Seule la DÉCLARATION est une séquence (ADR-0049) : l'ordre y est de l'information, ici non.
 *
 * Préférer `compileFields` pour valider ; celle-ci sert à qui doit composer le schéma avant de le
 * compiler, ou l'émettre en OpenAPI.
 *
 * @throws si un `component`/`list` cite un nom absent de `components`, ou boucle sur lui-même.
 */
export function fieldsToSchema(
  fields: readonly SerializedField[],
  components: Components,
  seen: Set<string>,
): TSchema {
  const shape: Record<string, TSchema> = {};
  for (const field of fields) {
    const schema = fieldToSchema(field, components, seen);
    shape[field.name] = field.required ? schema : t.Optional(schema);
  }
  return t.Object(shape);
}

/**
 * Compile un dictionnaire de champs en validateur, pour un consommateur hors de ce paquet.
 *
 * C'est la même traduction que pour une section — c'est le point qu'ADR-0026 désigne comme partagé
 * intégralement : « le schema, la liste de champs, et son validateur générique ». Les entités s'en
 * servent pour valider ce qu'on écrit dans leurs colonnes.
 *
 * `components` est passé en argument et non lu ici : un champ `list`/`component` d'une entité
 * référence un component du registre, que l'appelant seul sait charger.
 */
export function compileFields(
  fields: readonly SerializedField[],
  components: Components,
): TypeCheck<TSchema> {
  return TypeCompiler.Compile(fieldsToSchema(fields, components, new Set()));
}

/**
 * Noms de champs déclarés deux fois dans une même définition, en descendant les répéteurs.
 *
 * L'objet donnait cette garantie gratuitement — deux clés identiques ne coexistent pas. La séquence
 * l'admet (ADR-0049), donc elle se vérifie. Une garantie qui se voit vaut mieux qu'une garantie qui
 * tenait à la forme du conteneur, mais encore faut-il qu'elle soit posée sur TOUS les chemins
 * d'écriture — d'où cette fonction exportée plutôt qu'une garde locale au registre des pages : les
 * entités ont leur propre chemin de poussée, et elles s'en servent dans `planEntities`.
 *
 * Sans elle, le doublon est silencieux côté sections : `fieldsToSchema` écrase la première
 * occurrence, et le formulaire affiche deux champs dont un seul est validé. Côté entités, Postgres
 * refuse le DDL (« column specified more than once ») — mais au push, alors que `check` a déjà dit
 * que tout allait bien, et sans nommer l'entité fautive.
 *
 * Rend TOUTES les fautes, en clair. Même forme qu'`unknownRefTargets`.
 */
export function duplicateFieldNames(owner: string, fields: readonly SerializedField[]): string[] {
  const faults: string[] = [];
  const seen = new Set<string>();

  for (const field of fields) {
    if (seen.has(field.name)) faults.push(`« ${owner}.${field.name} »`);
    seen.add(field.name);
    if (field.kind === 'repeater') {
      faults.push(...duplicateFieldNames(`${owner}.${field.name}`, field.fields));
    }
  }

  return faults;
}
