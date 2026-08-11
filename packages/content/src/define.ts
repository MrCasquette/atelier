// Les quatre verbes de déclaration (naming validé) :
//   - defineComponent : atom/molecule — groupe de champs nommé RÉUTILISABLE, non insérable en page.
//   - defineSection   : bloc de page — va dans `page.sections`, fetché + bouclé par le front.
//   - defineEntity    : de la DONNÉE — table dérivée, vraies colonnes (ADR-0026, ADR-0027).
//   - defineContent   : racine — LE seul point lu par la CLI ; les components sont AUTO-COLLECTÉS
//                       en marchant les références des sections et des entités.
//
// Génériques : `defineSection`/`defineComponent`/`defineEntity` capturent les champs `F` (const) et
// le nom `Name` (littéral), `defineContent` capture les tuples `S` et `E`. Cette préservation
// alimente l'inférence de types côté front (`InferData` / `InferSections` / `InferEntity`).

import type {
  ContentDefinition,
  Definition,
  Entity,
  EntityLink,
  Fields,
  FieldValue,
} from './types.js';

export interface DefinitionConfig<F extends Fields> {
  label?: string;
  icon?: string;
  fields: F;
}

const define = <F extends Fields, Name extends string>(
  role: Definition['role'],
  name: Name,
  config: DefinitionConfig<F>,
): Definition<F, Name> => ({
  kind: 'definition',
  role,
  name,
  label: config.label,
  icon: config.icon,
  fields: config.fields,
});

export function defineComponent<const F extends Fields, Name extends string>(
  name: Name,
  config: DefinitionConfig<F>,
): Definition<F, Name> {
  return define('component', name, config);
}

export function defineSection<const F extends Fields, Name extends string>(
  name: Name,
  config: DefinitionConfig<F>,
): Definition<F, Name> {
  return define('section', name, config);
}

export interface EntityConfig<F extends Fields, Single extends boolean = false>
  extends DefinitionConfig<F> {
  /** Au plus une occurrence (CGV, politique de livraison). Aucune n'est créée d'office (ADR-0039). */
  singleton?: Single;
  /**
   * Rend l'entité citable dans un menu et dans un champ `ref` (ADR-0046).
   *
   * Une ligne suffit : `{ mode: 'route', route: '/blog/:slug' }`. Sans elle, l'entité existe et
   * s'édite, mais ne se cite pas — ce qui est le bon défaut pour ce qui ne se visite pas.
   */
  link?: EntityLink;
}

/**
 * Le nom d'une entité devient un identifiant SQL — une table est dérivée de cette déclaration
 * (ADR-0027). On le borne donc à une grammaire stricte plutôt que de l'échapper : échapper une
 * chaîne libre, c'est accepter n'importe quoi et espérer bien s'en tirer.
 *
 * Ce refus-ci sert le DEV, qui apprend sa faute en écrivant sa déclaration plutôt qu'au push.
 * Il ne remplace pas la vérification à la frontière : l'API revalide ce qu'elle reçoit, puisque
 * rien ne garantit qu'un registre poussé soit passé par ce chemin.
 */
const ENTITY_NAME = /^[a-z][a-z0-9_]*$/;

/**
 * Cohérence d'un `link` avec les champs qu'il nomme (ADR-0046).
 *
 * Un `href` qui cite un champ inexistant, un `anchor` qui cite un champ qui n'est pas un `ref` :
 * ce sont des liens qui ne se résoudront jamais, et rien ne le dirait au moment de l'écriture. Ils
 * se refusent ici, où le dev tient encore sa déclaration sous les yeux.
 *
 * La cardinalité entre aussi en jeu : un singleton n'a **pas de slug** (ADR-0039). Ni `:slug` dans
 * sa route, ni ancre à dériver de lui.
 */
function assertLink<F extends Fields>(name: string, config: EntityConfig<F, boolean>): void {
  const link = config.link;
  if (!link) return;

  const refuse = (why: string): never => {
    throw new Error(`defineEntity « ${name} » : ${why}`);
  };
  const singleton = config.singleton === true;
  const field = (key: string): FieldValue | undefined => config.fields[key];

  if (link.mode === 'route') {
    const hasSlug = link.route.includes(':slug');
    if (singleton && hasSlug) {
      refuse(
        `la route « ${link.route} » attend un slug, mais un singleton n'en a pas — son identité est son nom (ADR-0039).`,
      );
    }
    if (!singleton && !hasSlug) {
      refuse(
        `la route « ${link.route} » ne contient pas « :slug » : toutes les occurrences porteraient la même URL.`,
      );
    }
    return;
  }

  if (link.mode === 'href') {
    const carrier = field(link.field);
    if (!carrier) refuse(`le lien cite le champ « ${link.field} », qui n'est pas déclaré.`);
    if (!isFieldOfKind(carrier, 'text')) {
      refuse(`le champ « ${link.field} » doit être un champ texte pour porter une URL.`);
    }
    return;
  }

  if (singleton) {
    refuse("une ancre se dérive du slug de l'occurrence, et un singleton n'en a pas (ADR-0039).");
  }
  const parent = field(link.parent);
  if (!parent) refuse(`le lien cite le champ « ${link.parent} », qui n'est pas déclaré.`);
  if (!isFieldOfKind(parent, 'ref')) {
    refuse(`le champ « ${link.parent} » doit être un « ref » pour désigner l'entité parente.`);
  }
}

/** Un champ imbriqué par référence est une `Definition`, pas un descripteur : elle n'a pas de `kind` de champ. */
function isFieldOfKind(value: FieldValue | undefined, kind: 'text' | 'ref'): boolean {
  return value !== undefined && 'kind' in value && value.kind === kind;
}

export function defineEntity<
  const F extends Fields,
  Name extends string,
  const Single extends boolean = false,
>(name: Name, config: EntityConfig<F, Single>): Entity<F, Name, Single> {
  if (!ENTITY_NAME.test(name)) {
    throw new Error(
      `defineEntity : « ${name} » n'est pas un nom d'entité valide. Minuscules, chiffres et « _ », commençant par une lettre — son nom devient celui d'une table.`,
    );
  }
  assertLink(name, config);

  return {
    kind: 'entity',
    name,
    label: config.label,
    icon: config.icon,
    singleton: config.singleton,
    link: config.link,
    fields: config.fields,
  };
}

export interface ContentConfig<S extends readonly Definition[], E extends readonly Entity[]> {
  sections: S;
  entities?: E;
}

export function defineContent<
  const S extends readonly Definition[],
  const E extends readonly Entity[] = [],
>(config: ContentConfig<S, E>): ContentDefinition<S, E> {
  for (const section of config.sections) {
    if (section.role !== 'section') {
      throw new Error(
        `defineContent : « ${section.name} » est un component, pas une section. Seules les sections (defineSection) sont insérables en page.`,
      );
    }
  }
  for (const entity of config.entities ?? []) {
    if (entity.kind !== 'entity') {
      // `entity` est `never` ici : le type refuse déjà le mélange, ce contrôle attrape l'appelant
      // qui n'a pas de type-check (JS, ou registre construit à la main).
      const invalid: { name: string } = entity;
      throw new Error(
        `defineContent : « ${invalid.name} » n'est pas une entité. Une section est de la présentation, une entité est de la donnée — seul defineEntity produit une entité.`,
      );
    }
  }

  // Même assertion interne que `make` (cf. field.ts) : `E` vaut `[]` quand `entities` est absent,
  // ce que TypeScript ne sait pas prouver du littéral vide. Assertion de frontière côté lib.
  const entities = (config.entities ?? []) as E;
  return { kind: 'content', sections: config.sections, entities };
}
