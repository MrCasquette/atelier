// La surface publique de `@repo/prose`.
//
// L'ARBRE est le contrat (ADR-0061 §6) : il peut tout exprimer et s'enrichit sans rompre, quand une
// sortie HTML est plate. Ce qui n'est pas exporté ici n'existe pas pour l'extérieur — en particulier
// `mdast`, qui s'arrête à `parse.ts`.

export { parseProse } from './parse';
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
} from './tree';
