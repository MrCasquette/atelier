import { t } from 'elysia';
import type { MenuItem } from './schema';

// Ce qu'un menu EST, en schéma de validation — la forme de ce qui entre en base, pendant du type
// `MenuItem` qui type la colonne. Le CONTRAT de lecture storefront, lui, appartient au produit :
// il décrit ce qu'une route rend, pas ce qu'une donnée est (ADR-0044).

// `target` est un NOM de cible et non une union fermée (ADR-0032) : `'url'`, ou le nom d'une cible
// inscrite au registre de références. Le schéma ne peut pas l'énumérer — il ne les connaît pas.
// L'existence de la cible se vérifie à l'ÉCRITURE, contre le registre (cf. `unknownTargets`) : le
// schéma dit la forme, le registre dit ce qui existe.
const menuLink = t.Object({
  target: t.String({
    minLength: 1,
    description: '`url`, ou nom d’une cible référençable inscrite.',
  }),
  value: t.String({
    minLength: 1,
    description: 'URL (target=url) ou UUID de l’entité ciblée (cibles internes).',
  }),
  newTab: t.Optional(t.Boolean()),
});

// Item récursif : `Self` = référence à CE même item (thunk), pas une copie inline.
const menuItem = t.Recursive((Self) =>
  t.Object({
    label: t.String({ minLength: 1, maxLength: 200 }),
    link: menuLink,
    children: t.Array(Self),
  }),
);

// Piège récursion : le `Static` d'un `t.Recursive` s'effondre (`children: never[]`). On attache
// donc le type TS correct via `t.Unsafe<T>` : le runtime valide l'arbre récursif, le contrat
// client/handler porte le vrai type. `MenuItem` est la SSOT du shape.
export const menuItemsSchema = t.Unsafe<MenuItem[]>(t.Array(menuItem));
export type MenuItemInput = MenuItem;
