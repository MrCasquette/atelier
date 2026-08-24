// Arbre → HTML. La COMMODITÉ, pas le contrat (ADR-0061 §6).
//
// Le contrat est l'arbre : il exprime tout et s'enrichit sans rompre, quand du HTML est plat. Ce
// sérialiseur existe pour deux raisons précises — il rend correctement TOUT le noyau, et il porte la
// prévisualisation de l'administration, où le contenu vient de l'éditeur lui-même.
//
// Il est PUREMENT GÉNÉRIQUE : aucune directive n'y a de cas particulier. C'est ce que la V1 achète
// en n'admettant au noyau que des enveloppes. Le jour où un `leaf` y entrera — une vidéo, une
// iframe —, ce fichier devra connaître sa structure, et ce jour-là seulement.

import type { ProseBlock, ProseInline, ProseTree } from './tree.js';

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

// Le HTML brut est déjà refusé à l'entrée, mais cela n'arrête PAS `[clic](javascript:alert(1))` :
// une URL est un vecteur à part entière. On n'admet donc que des schémas sûrs, et tout ce qui est
// relatif — le cas courant d'un lien interne.
//
// Le nettoyage précède l'examen : espaces, tabulations et caractères de contrôle servent justement à
// masquer un schéma (`java\tscript:`), et la casse aussi (`JaVaScRiPt:`).
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/;

// Écrit en clair plutôt qu'en classe de caractères : une regex portant des caractères de contrôle
// est presque toujours une erreur, et le lint le signale à raison. Ici l'intention est explicite.
function withoutBlanksAndControls(value: string): string {
  let cleaned = '';
  for (const character of value) {
    if (character.charCodeAt(0) > 0x20) cleaned += character;
  }
  return cleaned;
}

export function safeUrl(url: string): string | null {
  const cleaned = withoutBlanksAndControls(url).toLowerCase();
  const scheme = HAS_SCHEME.exec(cleaned);
  if (scheme === null) return url; // relatif : `/contact`, `#ancre`, `./page`
  return SAFE_SCHEMES.has(scheme[0]) ? url : null;
}

// Un nom d'attribut vient du TEXTE, donc de n'importe où. Sans ce filtre, `{x" onclick="alert(1)}`
// briserait la balise. Le préfixe `data-` ne suffirait pas : c'est le nom lui-même qui doit être
// inerte.
const SAFE_ATTRIBUTE_NAME = /^[a-z][a-z0-9-]*$/;

function directiveAttributes(name: string, attributes: Readonly<Record<string, string>>): string {
  let rendered = ` data-directive="${escapeText(name)}"`;
  for (const [key, value] of Object.entries(attributes)) {
    if (!SAFE_ATTRIBUTE_NAME.test(key)) continue;
    rendered += ` data-${key}="${escapeText(value)}"`;
  }
  return rendered;
}

function inlineToHtml(nodes: readonly ProseInline[]): string {
  let html = '';

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        html += escapeText(node.value);
        break;
      case 'emphasis':
        html += `<em>${inlineToHtml(node.children)}</em>`;
        break;
      case 'strong':
        html += `<strong>${inlineToHtml(node.children)}</strong>`;
        break;
      case 'inlineCode':
        html += `<code>${escapeText(node.value)}</code>`;
        break;
      case 'link': {
        const href = safeUrl(node.href);
        // Une URL refusée ne devient pas `#` : le lien perd son `href` et reste inerte. Visible,
        // plutôt que silencieusement redirigé ailleurs.
        html +=
          href === null
            ? `<a>${inlineToHtml(node.children)}</a>`
            : `<a href="${escapeText(href)}">${inlineToHtml(node.children)}</a>`;
        break;
      }
      case 'image': {
        const src = safeUrl(node.src);
        html +=
          src === null
            ? `<img alt="${escapeText(node.alt)}" />`
            : `<img src="${escapeText(src)}" alt="${escapeText(node.alt)}" />`;
        break;
      }
      case 'break':
        html += '<br />';
        break;
      case 'directive':
        html += `<span${directiveAttributes(node.name, node.attributes)}>${inlineToHtml(node.children)}</span>`;
        break;
    }
  }

  return html;
}

function blocksToHtml(nodes: readonly ProseBlock[]): string {
  let html = '';

  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        html += `<p>${inlineToHtml(node.children)}</p>`;
        break;
      case 'heading':
        html += `<h${node.level}>${inlineToHtml(node.children)}</h${node.level}>`;
        break;
      case 'list': {
        const tag = node.ordered ? 'ol' : 'ul';
        const items = node.items.map((item) => `<li>${blocksToHtml(item)}</li>`).join('');
        html += `<${tag}>${items}</${tag}>`;
        break;
      }
      case 'quote':
        html += `<blockquote>${blocksToHtml(node.children)}</blockquote>`;
        break;
      case 'code': {
        // `data-language` plutôt qu'une `class` : la règle « des `data-*`, jamais des classes »
        // vaut aussi pour ce que NOUS émettons, pas seulement pour ce que le contenu déclare.
        const language =
          node.language === null ? '' : ` data-language="${escapeText(node.language)}"`;
        html += `<pre><code${language}>${escapeText(node.value)}</code></pre>`;
        break;
      }
      case 'rule':
        html += '<hr />';
        break;
      case 'directive': {
        const body =
          node.shape === 'container' ? blocksToHtml(node.children) : inlineToHtml(node.children);
        html += `<div${directiveAttributes(node.name, node.attributes)}>${body}</div>`;
        break;
      }
    }
  }

  return html;
}

export function proseToHtml(tree: ProseTree): string {
  return blocksToHtml(tree.children);
}
