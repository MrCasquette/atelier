// Texte → arbre de prose. Le SEUL fichier où l'outil de parsing transparaît (ADR-0061 §8).
//
// Tout ce qui vient de `mdast` s'arrête ici : au-delà, seul l'arbre de `tree.ts` circule. C'est ce
// qui rend l'outil remplaçable — si l'extension de directives est abandonnée, on en réécrit une et
// aucune donnée ne bouge, puisque la base ne contient que du texte.

import { fromMarkdown } from 'mdast-util-from-markdown';
import { directiveFromMarkdown } from 'mdast-util-directive';
import { directive } from 'micromark-extension-directive';
import type { Nodes, PhrasingContent, RootContent } from 'mdast';

import type {
  HeadingLevel,
  ProseAttributes,
  ProseBlock,
  ProseInline,
  ProseTree,
} from './tree';

// Les attributs arrivent en `string | null | undefined` — `{hidden}` sans valeur donne `null`. On
// normalise en chaîne vide plutôt que de propager trois formes d'absence.
//
// `class` n'est pas filtré, et c'est volontaire : la syntaxe `{.une-classe}` le produit, mais le
// sérialiseur n'émet que des `data-*`, si bien qu'il ressort en `data-class` — visible, et sans
// effet. L'échec est immédiat au lieu d'être différé, ce qui vaut mieux qu'un filtrage silencieux.
function toAttributes(raw: Record<string, string | null | undefined> | null | undefined): ProseAttributes {
  if (!raw) return {};
  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    attributes[key] = value ?? '';
  }
  return attributes;
}

function toHeadingLevel(depth: number): HeadingLevel {
  if (depth <= 1) return 1;
  if (depth >= 6) return 6;
  if (depth === 2) return 2;
  if (depth === 3) return 3;
  if (depth === 4) return 4;
  return 5;
}

// Repli pour un nœud que ce paquet ne modélise pas — références de liens, notes de bas de page.
// On préfère rendre son texte plutôt que le perdre en silence.
function textOf(node: Nodes): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('children' in node) return node.children.map((child) => textOf(child)).join('');
  return '';
}

function toInline(nodes: readonly PhrasingContent[]): ProseInline[] {
  const result: ProseInline[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        result.push({ type: 'text', value: node.value });
        break;
      case 'emphasis':
        result.push({ type: 'emphasis', children: toInline(node.children) });
        break;
      case 'strong':
        result.push({ type: 'strong', children: toInline(node.children) });
        break;
      case 'inlineCode':
        result.push({ type: 'inlineCode', value: node.value });
        break;
      case 'link':
        result.push({ type: 'link', href: node.url, children: toInline(node.children) });
        break;
      case 'image':
        result.push({ type: 'image', src: node.url, alt: node.alt ?? '' });
        break;
      case 'break':
        result.push({ type: 'break' });
        break;
      case 'textDirective':
        result.push({
          type: 'directive',
          shape: 'inline',
          name: node.name,
          attributes: toAttributes(node.attributes),
          children: toInline(node.children),
        });
        break;
      default: {
        // `html` n'arrive jamais : les constructions HTML sont désactivées à la source (§7). Le
        // reste — références, notes — retombe sur son texte.
        const text = textOf(node);
        if (text !== '') result.push({ type: 'text', value: text });
      }
    }
  }

  return result;
}

function toBlocks(nodes: readonly RootContent[]): ProseBlock[] {
  const result: ProseBlock[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        result.push({ type: 'paragraph', children: toInline(node.children) });
        break;
      case 'heading':
        result.push({
          type: 'heading',
          level: toHeadingLevel(node.depth),
          children: toInline(node.children),
        });
        break;
      case 'blockquote':
        result.push({ type: 'quote', children: toBlocks(node.children) });
        break;
      case 'list':
        result.push({
          type: 'list',
          ordered: node.ordered ?? false,
          items: node.children.map((item) => toBlocks(item.children)),
        });
        break;
      case 'code':
        result.push({ type: 'code', language: node.lang ?? null, value: node.value });
        break;
      case 'thematicBreak':
        result.push({ type: 'rule' });
        break;
      case 'containerDirective':
        result.push({
          type: 'directive',
          shape: 'container',
          name: node.name,
          attributes: toAttributes(node.attributes),
          children: toBlocks(node.children),
        });
        break;
      case 'leafDirective':
        result.push({
          type: 'directive',
          shape: 'leaf',
          name: node.name,
          attributes: toAttributes(node.attributes),
          children: toInline(node.children),
        });
        break;
      default: {
        const text = textOf(node);
        if (text !== '') result.push({ type: 'paragraph', children: [{ type: 'text', value: text }] });
      }
    }
  }

  return result;
}

// Le HTML brut est REFUSÉ à la source — `htmlFlow` et `htmlText` désactivés dans le tokenizer.
// C'est l'invariant de sécurité d'ADR-0061 §7 : sans lui, la sortie n'est plus close et tout le
// raisonnement s'effondre. Un `<script>` écrit dans le contenu ressort donc en texte, échappé.
const DISABLE_HTML = { disable: { null: ['htmlFlow', 'htmlText'] } };

export function parseProse(source: string): ProseTree {
  const root = fromMarkdown(source, {
    extensions: [directive(), DISABLE_HTML],
    mdastExtensions: [directiveFromMarkdown()],
  });

  return { children: toBlocks(root.children) };
}
