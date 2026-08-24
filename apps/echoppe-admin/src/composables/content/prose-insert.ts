import type { DirectiveShape } from '@axiome-apps/atelier-prose';

// Ce que produit un bouton de la barre de directives (ADR-0061 §9 : « un bouton n'a plus qu'à
// insérer du texte au curseur »).
//
// Extrait du composant parce que c'est la seule partie qui RAISONNE — la forme de la syntaxe et
// l'isolement d'un bloc ont des cas limites, et le dépôt teste la logique pure plutôt que le rendu.

export interface Insertion {
  /** Le texte complet après insertion. */
  readonly value: string;
  /** Où poser le curseur ensuite. */
  readonly caret: number;
}

/**
 * La syntaxe d'une directive dépend de sa forme, et d'elle seule (ADR-0061 §6).
 *
 * Le texte d'exemple n'est fourni que si la sélection est vide : sinon on ENVELOPPE, ce qui est la
 * règle du §2 — sélectionner un lien puis cliquer « cta » produit un `:::cta` autour du lien, qui
 * reste un vrai lien Markdown.
 */
export function directiveSnippet(
  name: string,
  shape: DirectiveShape,
  selected: string,
): string {
  if (shape === 'inline') return `:${name}[${selected || 'texte'}]`;
  if (shape === 'leaf') return `::${name}[${selected || 'légende'}]`;
  return `:::${name}\n${selected || 'Votre texte.'}\n:::`;
}

/**
 * Insère une directive à la position donnée, en enveloppant la sélection s'il y en a une.
 *
 * Un CONTENEUR est un bloc : sans ligne à lui, `:::warning` collé à la fin d'un paragraphe se lit
 * comme du texte au fil de la phrase et le parseur ne le reconnaît pas — le bouton produirait alors
 * des deux-points visibles au lieu d'un encadré. C'est le seul cas où l'insertion ajoute des sauts
 * de ligne, et elle n'en ajoute que ce qui manque.
 */
export function insertDirective(
  value: string,
  start: number,
  end: number,
  name: string,
  shape: DirectiveShape,
): Insertion {
  const before = value.slice(0, start);
  const after = value.slice(end);
  let text = directiveSnippet(name, shape, value.slice(start, end));

  if (shape === 'container') {
    if (before !== '' && !before.endsWith('\n\n')) {
      text = (before.endsWith('\n') ? '\n' : '\n\n') + text;
    }
    if (after !== '' && !after.startsWith('\n')) text = `${text}\n`;
  }

  return { value: before + text + after, caret: before.length + text.length };
}
