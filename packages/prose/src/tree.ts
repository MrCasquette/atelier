// L'arbre de prose — le contrat public de ce paquet (ADR-0061 §8).
//
// Il est DÉLIBÉRÉMENT le nôtre, et non celui du parseur. `mdast` n'est jamais exposé : ce qui
// traverse cette frontière est stable même si l'outil de parsing change, et un outil abandonné se
// remplace alors sans migrer une donnée.
//
// Il est aussi ÉPHÉMÈRE. Rien de tout ceci ne se stocke : la base ne contient que le texte source,
// octet pour octet celui qui a été écrit, et cet arbre est reconstruit à chaque rendu. Le cacher en
// base ramènerait à un format propriétaire avec deux sources de vérité — la seule dérive qui
// détruirait la thèse d'ADR-0061 sans qu'aucun test ne tombe.

// Les attributs d'une directive sont TOUJOURS des chaînes : ils sont parsés depuis du texte, si bien
// que `{count=3}` arrive en `"3"`. C'est ce qui interdit de réutiliser le modèle de champs des
// sections, qui décrit du JSON déjà typé.
export type ProseAttributes = Readonly<Record<string, string>>;

// ── Inline ────────────────────────────────────────────────────────────────────────────────────
export type ProseInline =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'emphasis'; readonly children: readonly ProseInline[] }
  | { readonly type: 'strong'; readonly children: readonly ProseInline[] }
  | { readonly type: 'inlineCode'; readonly value: string }
  | { readonly type: 'link'; readonly href: string; readonly children: readonly ProseInline[] }
  | { readonly type: 'image'; readonly src: string; readonly alt: string }
  // Le saut dur d'ADR-0030 : l'antislash en fin de ligne, jamais le double espace — invisible et
  // supprimé par n'importe quel `trim()`.
  | { readonly type: 'break' }
  | ProseInlineDirective;

// ── Blocs ─────────────────────────────────────────────────────────────────────────────────────
export type ProseBlock =
  | { readonly type: 'paragraph'; readonly children: readonly ProseInline[] }
  | { readonly type: 'heading'; readonly level: HeadingLevel; readonly children: readonly ProseInline[] }
  | { readonly type: 'list'; readonly ordered: boolean; readonly items: readonly (readonly ProseBlock[])[] }
  | { readonly type: 'quote'; readonly children: readonly ProseBlock[] }
  | { readonly type: 'code'; readonly language: string | null; readonly value: string }
  | { readonly type: 'rule' }
  | ProseBlockDirective;

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

// ── Directives ────────────────────────────────────────────────────────────────────────────────
// Trois formes, et la forme SYNTAXIQUE détermine ce que la directive peut produire (ADR-0061 §6) :
//
//   container  `:::warning`  un corps de PROSE          → enveloppe        `warning`, `cta`, `quote`
//   leaf       `::figure`    pas de corps, un label     → média            `figure`
//   inline     `:highlight`  au fil d'une phrase        → élément inline   `highlight`
//
// Une directive CRÉE un nœud, elle n'en décore pas un qui existe : pour qu'un lien ait l'allure d'un
// bouton, on l'enveloppe au lieu de lui coller un attribut, et le lien reste un vrai lien.
export type ProseBlockDirective =
  | {
      readonly type: 'directive';
      readonly shape: 'container';
      readonly name: string;
      readonly attributes: ProseAttributes;
      readonly children: readonly ProseBlock[];
    }
  | {
      readonly type: 'directive';
      readonly shape: 'leaf';
      readonly name: string;
      readonly attributes: ProseAttributes;
      readonly children: readonly ProseInline[];
    };

export type ProseInlineDirective = {
  readonly type: 'directive';
  readonly shape: 'inline';
  readonly name: string;
  readonly attributes: ProseAttributes;
  readonly children: readonly ProseInline[];
};

export type ProseDirective = ProseBlockDirective | ProseInlineDirective;

// La racine. Un document de prose est une suite de blocs — rien de plus, pas d'en-tête, pas de
// métadonnée : ce qui n'est pas dans le texte n'existe pas.
export type ProseTree = { readonly children: readonly ProseBlock[] };

// ── Parcours ──────────────────────────────────────────────────────────────────────────────────
// Fourni parce que tout consommateur en écrit un sinon, et le referait mal. Visite chaque directive
// de l'arbre, blocs et inline confondus, parents avant enfants.
export function visitDirectives(
  tree: ProseTree,
  visit: (directive: ProseDirective) => void,
): void {
  const walkInline = (nodes: readonly ProseInline[]): void => {
    for (const node of nodes) {
      if (node.type === 'directive') {
        visit(node);
        walkInline(node.children);
        continue;
      }
      if (node.type === 'emphasis' || node.type === 'strong' || node.type === 'link') {
        walkInline(node.children);
      }
    }
  };

  const walkBlocks = (nodes: readonly ProseBlock[]): void => {
    for (const node of nodes) {
      switch (node.type) {
        case 'directive':
          visit(node);
          if (node.shape === 'container') walkBlocks(node.children);
          else walkInline(node.children);
          break;
        case 'paragraph':
        case 'heading':
          walkInline(node.children);
          break;
        case 'quote':
          walkBlocks(node.children);
          break;
        case 'list':
          for (const item of node.items) walkBlocks(item);
          break;
        case 'code':
        case 'rule':
          break;
      }
    }
  };

  walkBlocks(tree.children);
}
