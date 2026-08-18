import type { LocationQueryValue } from 'vue-router';

// Lecture d'un segment d'URL, vérifiée.
//
// Vue Router type `params` en `string | string[]` et `query` en `string | null | (…)[]`, parce que
// `?tab=a&tab=b` est une URL valide et que rien n'oblige un paramètre à être présent. Treize
// endroits affirmaient une chaîne : une URL malformée traversait l'affirmation et partait en
// identifiant de requête, où elle donnait un 404 ou un `undefined` bien plus loin.

/** Le paramètre d'itinéraire, ou `null` s'il est absent ou répété. */
export function param(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Le paramètre de requête, ou `null`. Une valeur répétée (`?a=1&a=2`) n'en est pas une. */
export function query(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
