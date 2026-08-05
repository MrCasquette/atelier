import type { MenuItem } from '@echoppe/core';
import { type Static, t } from 'elysia';

// Modèles du menu de navigation (built-in, hors registre @mrcasquette/content). Un menu = arbre
// ORDONNÉ et RÉCURSIF d'items ; `children` référence le même item (récursivité illimitée via
// `t.Recursive`). Deux mondes :
//   - STOCKAGE / écriture : le lien porte une URL ou un UUID d'entité brut.
//   - LECTURE storefront : les refs internes sont RÉSOLUES en projection { id, slug, name }.
//
// Piège récursion : le `Static` d'un `t.Recursive` s'effondre (`children: never[]`). On attache
// donc le type TS correct via `t.Unsafe<T>` (même remède que le vocabulaire de scopes api-key) :
// le runtime valide l'arbre récursif, le contrat client/handler porte le vrai type. `MenuItem` est
// la SSOT du shape (défini en core, sert aussi à typer la colonne jsonb).

// ── Stockage / écriture ───────────────────────────────────────────────────────────────────────
const menuLink = t.Object({
  target: t.Union([
    t.Literal('url'),
    t.Literal('page'),
    t.Literal('product'),
    t.Literal('collection'),
    t.Literal('category'),
  ]),
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

// Runtime = validateur récursif ; Static = MenuItem[] (récursion préservée, cf. piège ci-dessus).
export const menuItemsSchema = t.Unsafe<MenuItem[]>(t.Array(menuItem));
export type MenuItemInput = MenuItem;

// ── Lecture storefront (refs résolues) ────────────────────────────────────────────────────────
export interface EntityProjection {
  id: string;
  slug: string;
  name: string;
}

export type ResolvedMenuLink =
  | { target: 'url'; url: string; newTab?: boolean }
  | {
      target: 'page' | 'product' | 'collection' | 'category';
      entity: EntityProjection | null; // null si la ref est dangling (entité supprimée)
      newTab?: boolean;
    };

export interface ResolvedMenuItem {
  label: string;
  link: ResolvedMenuLink;
  children: ResolvedMenuItem[];
}

const entityProjection = t.Object({ id: t.String(), slug: t.String(), name: t.String() });

const resolvedLink = t.Union([
  t.Object({ target: t.Literal('url'), url: t.String(), newTab: t.Optional(t.Boolean()) }),
  t.Object({
    target: t.Union([
      t.Literal('page'),
      t.Literal('product'),
      t.Literal('collection'),
      t.Literal('category'),
    ]),
    entity: t.Nullable(entityProjection),
    newTab: t.Optional(t.Boolean()),
  }),
]);

// `$id` explicite : le schéma récursif est émis comme composant nommé dans le contrat OpenAPI
// (le générateur du client hisse les nœuds `$id` en `components.schemas` → self-ref résolvable).
const resolvedMenuItem = t.Recursive(
  (Self) => t.Object({ label: t.String(), link: resolvedLink, children: t.Array(Self) }),
  { $id: 'MenuItemResolved' },
);

const resolvedMenu = t.Object({
  handle: t.String(),
  label: t.String(),
  items: t.Unsafe<ResolvedMenuItem[]>(t.Array(resolvedMenuItem)),
});

export type ResolvedMenu = Static<typeof resolvedMenu>;

// Modèle nommé exposé dans le contrat (components.schemas → type côté @echoppe/client).
export const menuModels = { Menu: resolvedMenu };
