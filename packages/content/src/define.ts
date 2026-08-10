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

import type { ContentDefinition, Definition, Entity, Fields } from './types.js';

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
  return {
    kind: 'entity',
    name,
    label: config.label,
    icon: config.icon,
    singleton: config.singleton,
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
