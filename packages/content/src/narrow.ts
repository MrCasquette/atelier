// Franchissement `unknown → typé` côté front (P2c).
//
// Le SDK (`@echoppe/client`) type les sections d'une page comme `{ id, type: string, data: unknown }`
// — il ne PEUT pas connaître le registre déclaré par le dev (contrat OpenAPI agnostique). `asSections`
// retype ce tableau brut en union discriminée inférée de la déclaration du dev (`InferSections<C>`).
//
// C'est l'UNIQUE cast de frontière de la partie front : légitime car l'API a déjà validé la donnée
// à l'écriture (cf. validateur registre-dérivé, P2b) → on truste, exactement comme le front
// truste déjà les types du SDK pour tout le catalogue. Le dev n'écrit donc jamais de `as` lui-même :
// il appelle `asSections(content, page.sections)` à sa frontière (typiquement `src/lib/api.ts`).

import type { ContentDefinition, InferSections } from './types.js';

/** Forme brute d'une section telle que renvoyée par le SDK. */
export interface RawSection {
  id: string;
  type: string;
  data: unknown;
}

/**
 * Retype les sections brutes du SDK selon la déclaration `content`. `content` ne sert qu'à porter
 * le type `C` (inutilisé au runtime — identité). Zéro validation : l'API a validé à l'écriture.
 */
export function asSections<C extends ContentDefinition>(
  _content: C,
  raw: readonly RawSection[],
): InferSections<C>[] {
  return raw as InferSections<C>[];
}
