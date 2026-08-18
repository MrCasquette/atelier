// Lecture d'un événement du DOM, vérifiée.
//
// `event.target` vaut `EventTarget | null` : le navigateur ne promet rien de plus, et il a raison —
// un même gestionnaire sert plusieurs éléments, et un `blur` peut viser l'extérieur du document.
// Vingt-cinq endroits affirmaient l'élément attendu, ce qui ne vérifiait rien : sur un événement
// délégué ou déclenché par un test, la propriété lue valait `undefined` sans que rien ne le dise.
//
// `instanceof` fait le même travail en le prouvant, et rend le cas absent explicite.

/** La valeur d'un champ de saisie, ou `null` si l'événement ne vient pas d'un champ. */
export function inputValue(event: Event): string | null {
  const target = event.target;
  return target instanceof HTMLInputElement ? target.value : null;
}

/** La valeur d'un `<select>`, ou `null`. */
export function selectValue(event: Event): string | null {
  const target = event.target;
  return target instanceof HTMLSelectElement ? target.value : null;
}

/** L'élément qui porte le gestionnaire — `currentTarget`, pas `target`. */
export function currentElement(event: Event): HTMLElement | null {
  const target = event.currentTarget;
  return target instanceof HTMLElement ? target : null;
}

/** L'élément visé par l'événement. */
export function targetElement(event: Event): HTMLElement | null {
  const target = event.target;
  return target instanceof HTMLElement ? target : null;
}

/** L'élément que le pointeur rejoint — `null` quand il quitte la fenêtre. */
export function relatedElement(event: MouseEvent | FocusEvent): HTMLElement | null {
  return event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
}

/** Le nœud visé, pour les tests de confinement (`contains`). */
export function targetNode(event: Event): Node | null {
  return event.target instanceof Node ? event.target : null;
}
