// Le noyau de directives — ce que nos thèmes s'engagent à dessiner (ADR-0061 §4).
//
// Fermé : une directive du noyau ne se redéfinit pas. Tout le reste traverse sans validation ni
// garantie de style, et c'est voulu — une V1 qui offrirait moins que le HTML ferait du choix de
// Markdown une régression.
//
// TOUTES SONT DES ENVELOPPES. C'est la contrainte de la V1, et elle a une conséquence heureuse : le
// sérialiseur HTML reste PUREMENT GÉNÉRIQUE, sans table de structures par directive. Le critère qui
// la tient :
//
//   si Markdown sait produire le contenu, on enveloppe ; sinon, c'est un `leaf`.
//
// Une image, un lien, du texte : Markdown les produit. Une vidéo intégrée, une iframe : non — ce
// sera un `leaf`, il exigera que le rendu connaisse sa structure, et c'est la V2.

import type { ProseDirective, ProseTree } from './tree';
import { visitDirectives } from './tree';

export type DirectiveShape = 'container' | 'leaf' | 'inline';

// Un attribut ne dit qu'une chose pour l'instant : est-il exigé. Pas de `format` — aucune directive
// du noyau n'en a besoin, et l'ajouter avant l'usage serait de l'abstraction par anticipation. Il se
// rajoutera sans rupture, comme tout le reste de ce modèle.
export type AttributeSpec = { readonly required?: boolean };

export type DirectiveSpec = {
  readonly shape: DirectiveShape;
  readonly attributes: Readonly<Record<string, AttributeSpec>>;
};

export type DirectiveRegistry = Readonly<Record<string, DirectiveSpec>>;

const CONTAINER_WITHOUT_ATTRIBUTES: DirectiveSpec = { shape: 'container', attributes: {} };

export const CORE_DIRECTIVES: DirectiveRegistry = {
  // Encadrés d'information. Une seule famille réelle du noyau : une fois la boîte dessinée, les
  // deux autres ne sont qu'une couleur et une icône.
  warning: CONTAINER_WITHOUT_ATTRIBUTES,
  note: CONTAINER_WITHOUT_ATTRIBUTES,
  tip: CONTAINER_WITHOUT_ATTRIBUTES,

  // Une image et sa légende. Enveloppe plutôt que `leaf` : l'image reste un `![alt](src)` Markdown
  // standard, donc lisible partout. En faire un attribut — `::figure{src=…}` — l'aurait effacée de
  // tout outil ignorant la directive, exactement le reproche fait à `:button{href=…}`.
  figure: CONTAINER_WITHOUT_ATTRIBUTES,

  // Une citation attribuée. `author` est le seul attribut du noyau entier.
  quote: { shape: 'container', attributes: { author: {} } },

  // Un appel à l'action. Le lien qu'il enveloppe reste un vrai lien : c'est tout l'objet de la
  // règle « on n'annote pas, on enveloppe ».
  cta: CONTAINER_WITHOUT_ATTRIBUTES,

  // La seule inline du noyau.
  highlight: { shape: 'inline', attributes: {} },
};

// ── Validation ────────────────────────────────────────────────────────────────────────────────
// Rien n'est jeté : on rend des constats, et l'appelant décide. C'est l'idiome de `registryIssues`
// dans `@repo/pages-registry` — un paquet qui calcule ne choisit pas la réponse HTTP.
export type ProseIssue =
  | { readonly kind: 'wrong_shape'; readonly directive: string; readonly expected: DirectiveShape; readonly found: DirectiveShape }
  | { readonly kind: 'missing_attribute'; readonly directive: string; readonly attribute: string }
  | { readonly kind: 'unknown_attribute'; readonly directive: string; readonly attribute: string };

function issuesFor(directive: ProseDirective, spec: DirectiveSpec): ProseIssue[] {
  const issues: ProseIssue[] = [];

  if (directive.shape !== spec.shape) {
    issues.push({
      kind: 'wrong_shape',
      directive: directive.name,
      expected: spec.shape,
      found: directive.shape,
    });
  }

  for (const [name, attribute] of Object.entries(spec.attributes)) {
    if (attribute.required === true && (directive.attributes[name] ?? '') === '') {
      issues.push({ kind: 'missing_attribute', directive: directive.name, attribute: name });
    }
  }

  for (const name of Object.keys(directive.attributes)) {
    if (!(name in spec.attributes)) {
      issues.push({ kind: 'unknown_attribute', directive: directive.name, attribute: name });
    }
  }

  return issues;
}

// Ce qui n'est pas au registre n'est PAS une anomalie : c'est une directive du dev, qui voyage
// structurée et sans garantie. On ne valide que ce qu'on garantit.
export function proseIssues(tree: ProseTree, registry: DirectiveRegistry = CORE_DIRECTIVES): ProseIssue[] {
  const issues: ProseIssue[] = [];

  visitDirectives(tree, (directive) => {
    const spec = registry[directive.name];
    if (spec === undefined) return;
    issues.push(...issuesFor(directive, spec));
  });

  return issues;
}

export function describeIssue(issue: ProseIssue): string {
  switch (issue.kind) {
    case 'wrong_shape':
      return `« ${issue.directive} » s'écrit en ${issue.expected}, pas en ${issue.found}.`;
    case 'missing_attribute':
      return `« ${issue.directive} » exige l'attribut « ${issue.attribute} ».`;
    case 'unknown_attribute':
      return `« ${issue.directive} » ne connaît pas l'attribut « ${issue.attribute} ».`;
  }
}
