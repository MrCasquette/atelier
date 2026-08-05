import { type Column, eq, type SQL } from '@echoppe/core';

// Filtre de visibilité storefront (ADR-0006), nommé une seule fois plutôt que réécrit par route.
// Un principal privilégié (admin / clé d'API) voit tout ; un anonyme est borné aux lignes visibles
// (`isVisible = true`). Renvoie `undefined` pour un privilégié (aucune contrainte) → se compose dans
// `and(...)`, que Drizzle ignore lorsqu'une condition est `undefined`.
//
// Usage :
//   .where(visibilityFilter(collection.isVisible, isPrivileged))                    // liste
//   .where(and(eq(collection.id, id), visibilityFilter(collection.isVisible, priv))) // unité
//
// Porter la décision de sécurité dans un helper la rend grep-able et testable : oublier la branche
// `isVisible` dans une nouvelle route devient visible (on n'appelle pas le helper), au lieu d'être un
// ternaire silencieusement omis.
export function visibilityFilter(isVisibleColumn: Column, isPrivileged: boolean): SQL | undefined {
  return isPrivileged ? undefined : eq(isVisibleColumn, true);
}
