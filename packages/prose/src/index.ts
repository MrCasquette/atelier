// La surface publique de `@axiome-apps/atelier-prose`.
//
// L'ARBRE est le contrat (ADR-0061 §6) : il exprime tout et s'enrichit sans rompre, quand une sortie
// HTML est plate. `proseToHtml` est une COMMODITÉ — elle rend tout le noyau et porte la
// prévisualisation de l'administration, mais une directive du dev qui doit produire de la structure
// passe par l'arbre.
//
// Ce qui n'est pas exporté ici n'existe pas pour l'extérieur — `mdast` en particulier, qui s'arrête
// à `parse.ts`.

export { parseProse } from './parse.js';
export { proseToHtml, safeUrl } from './html.js';
export {
  CORE_DIRECTIVES,
  describeIssue,
  proseIssues,
  type AttributeSpec,
  type DirectiveRegistry,
  type DirectiveShape,
  type DirectiveSpec,
  type ProseIssue,
} from './core.js';
export {
  visitDirectives,
  type HeadingLevel,
  type ProseAttributes,
  type ProseBlock,
  type ProseBlockDirective,
  type ProseDirective,
  type ProseInline,
  type ProseInlineDirective,
  type ProseTree,
} from './tree.js';
