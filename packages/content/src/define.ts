// Les cinq verbes de déclaration (naming validé) :
//   - defineComponent : atom/molecule — groupe de champs nommé RÉUTILISABLE, non insérable en page.
//   - defineSection   : bloc de page — va dans `page.sections`, fetché + bouclé par le front.
//   - defineEntity    : de la DONNÉE — table dérivée, vraies colonnes (ADR-0026, ADR-0027).
//   - defineDirective : une inflexion du FIL d'une prose, pas un bloc de la page (ADR-0061 §3).
//                       Rien n'en va en base : elle ne se pousse pas, elle se rend.
//   - defineContent   : racine — LE seul point lu par la CLI ; les components sont AUTO-COLLECTÉS
//                       en marchant les références des sections et des entités.
//
// Génériques : `defineSection`/`defineComponent`/`defineEntity` capturent les champs `F` (const) et
// le nom `Name` (littéral), `defineContent` capture les tuples `S` et `E`. Cette préservation
// alimente l'inférence de types côté front (`InferData` / `InferSections` / `InferEntity`).

import {
  CORE_DIRECTIVES,
  type AttributeSpec,
  type DirectiveRegistry,
  type DirectiveShape,
  type DirectiveSpec,
} from '@axiome-apps/atelier-prose';
import type {
  ContentDefinition,
  Definition,
  Directive,
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

/**
 * Un nom de champ commence par une LETTRE — INVARIANT (ADR-0049).
 *
 * Ce n'est pas une convention de style, c'est ce qui rend l'ordre déclaré fiable. Les champs
 * s'écrivent dans un objet littéral, et JavaScript énumère les clés qui ressemblent à un index de
 * tableau EN TÊTE et par ordre numérique croissant :
 *
 *   Object.keys({ titre: 1, '2024': 2, corps: 3, '7': 4 })  →  ['7', '2024', 'titre', 'corps']
 *
 * Le brouillage a lieu à l'écriture, avant toute sérialisation : passer à une séquence ne le
 * rattrape pas, `json` non plus. On refuse donc le seul cas où il se produit, plutôt que de
 * prétendre garantir un ordre qu'on ne tiendrait pas.
 */
const FIELD_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;

function assertFieldNames(name: string, fields: Fields): void {
  for (const key of Object.keys(fields)) {
    if (!FIELD_NAME.test(key)) {
      throw new Error(
        `Nom de champ refusé dans « ${name} » : « ${key} ». Un champ commence par une lettre, ` +
          `puis lettres, chiffres et « _ » — un nom numérique casserait l'ordre de déclaration.`,
      );
    }
  }
}

const define = <F extends Fields, Name extends string>(
  role: Definition['role'],
  name: Name,
  config: DefinitionConfig<F>,
): Definition<F, Name> => {
  assertFieldNames(name, config.fields);
  return {
    kind: 'definition',
    role,
    name,
    label: config.label,
    icon: config.icon,
    fields: config.fields,
  };
};

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

/**
 * Ce qu'une directive déclare, et c'est tout : quels attributs existent, lesquels sont requis
 * (ADR-0061 §3).
 *
 * Pas de `format` — aucune directive du noyau n'en a besoin, et l'ajouter avant l'usage serait de
 * l'abstraction par anticipation. Il se rajoutera sans rupture, comme tout le reste de ce modèle.
 */
export interface DirectiveConfig {
  shape: DirectiveShape;
  attributes?: Readonly<Record<string, AttributeSpec>>;
}

/**
 * Déclare une directive que le front saura rendre.
 *
 * Le verbe est NU — comme `defineSection`, `defineComponent` et `defineEntity`, dont aucun ne porte
 * de préfixe. `defineProse` a été écarté : la prose est une matière, pas un objet dénombrable, et on
 * ne définit pas *une* prose.
 *
 * Une directive déclarée ici est validée et garantie dessinée ; ce qui n'est pas déclaré traverse
 * quand même, structuré et sans garantie de style (ADR-0061 §4). Déclarer AJOUTE des garanties, ça
 * n'ouvre rien — c'est ce qui rend le passage monotone, donc sans rupture pour un contenu déjà écrit.
 */
export function defineDirective(name: string, config: DirectiveConfig): Directive {
  if (!DIRECTIVE_NAME.test(name)) {
    throw new Error(
      `defineDirective : « ${name} » n'est pas un nom de directive valide. Minuscules, chiffres et « - », commençant par une lettre — c'est ce qui s'écrit après les deux-points dans le texte.`,
    );
  }
  if (name in CORE_DIRECTIVES) {
    throw new Error(
      `defineDirective : « ${name} » appartient au noyau, qui est fermé (ADR-0061 §4). Une directive du noyau ne se redéfinit pas — la collision est impossible plutôt qu'improbable. Choisissez un autre nom.`,
    );
  }

  return { kind: 'directive', name, shape: config.shape, attributes: config.attributes ?? {} };
}

/**
 * Le nom d'une directive tel qu'il s'écrit dans le texte, après les deux-points.
 *
 * Le tiret est admis — `:::mon-encart` se lit —, le point et l'underscore non : ils entrent en
 * conflit avec la syntaxe d'attributs abrégés que l'extension de directives reconnaît (`.classe`,
 * `#identifiant`). Refuser ici évite une directive qui se déclare et ne se parse jamais.
 */
const DIRECTIVE_NAME = /^[a-z][a-z0-9-]*$/;

export interface ContentConfig<S extends readonly Definition[], E extends readonly Entity[]> {
  sections: S;
  entities?: E;
  /**
   * Les directives du dev. **Non génériques, et c'est délibéré** : un attribut de directive est une
   * `string`, toujours — il n'y a pas de formulaire à générer ni rien à inférer (ADR-0061 §3). Elles
   * traversent donc sans capture de littéraux, là où sections et entités en ont besoin.
   */
  directives?: readonly Directive[];
}

// Deux surcharges plutôt qu'un défaut générique : `E` vaut `[]` quand `entities` est absent, ce que
// TypeScript ne sait pas prouver d'un littéral vide — c'est ce qu'une assertion masquait ici. Les
// surcharges portent la précision, l'implémentation n'est plus générique et n'a rien à affirmer.
export function defineContent<const S extends readonly Definition[]>(
  config: ContentConfig<S, []> & { entities?: undefined },
): ContentDefinition<S, []>;
export function defineContent<
  const S extends readonly Definition[],
  const E extends readonly Entity[],
>(config: ContentConfig<S, E> & { entities: E }): ContentDefinition<S, E>;
export function defineContent(
  config: ContentConfig<readonly Definition[], readonly Entity[]>,
): ContentDefinition<readonly Definition[], readonly Entity[]> {
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

  const directives = config.directives ?? [];
  const seen = new Set<string>();
  for (const directive of directives) {
    if (seen.has(directive.name)) {
      throw new Error(
        `defineContent : la directive « ${directive.name} » est déclarée deux fois. La seconde écraserait la première sans que rien ne le dise.`,
      );
    }
    seen.add(directive.name);
  }

  return {
    kind: 'content',
    sections: config.sections,
    entities: config.entities ?? [],
    directives,
  };
}

/**
 * Le registre à passer au rendu et à `proseIssues` — le noyau, plus ce que le dev a déclaré.
 *
 * Fourni parce que tout consommateur l'écrirait sinon, et le ferait mal : passer ses seules
 * directives à `proseIssues` PERD la validation du noyau, sans que rien ne le signale. Même raison
 * que `visitDirectives` côté prose.
 *
 * L'ordre de fusion n'a pas d'importance — `defineDirective` refuse déjà un nom du noyau, si bien
 * qu'aucune clé ne peut se recouvrir.
 */
export function directiveRegistry(content: ContentDefinition): DirectiveRegistry {
  const declared: Record<string, DirectiveSpec> = {};
  for (const directive of content.directives) {
    declared[directive.name] = { shape: directive.shape, attributes: directive.attributes };
  }
  return { ...CORE_DIRECTIVES, ...declared };
}
