import type { ResolvedMenuItem } from '@repo/menus';
import { type Static, t } from 'elysia';

// CONTRAT de lecture storefront d'un menu : ce qu'une route rend, pas ce qu'une donnée est. À ce
// titre il appartient au produit (ADR-0044) — la forme STOCKÉE, elle, vit dans `@repo/menus`.

const entityProjection = t.Object({
  id: t.String(),
  slug: t.String(),
  name: t.String(),
  // URL déjà calculée, pour les cibles dont le front ne peut pas la dériver (ADR-0046) : une entité
  // qui PORTE son URL dans un champ, ou dont le lien est une ancre sur sa parente. Absente pour le
  // mode `route`, où le slug et la route déclarée suffisent — le front reste maître de l'URL
  // partout où il peut la construire.
  url: t.Optional(t.Nullable(t.String())),
});

// Les deux branches restent discriminables sans énumérer les cibles : un lien en clair porte `url`
// et pas `entity`, un lien d'entité l'inverse. C'est la PRÉSENCE du champ qui tranche, pas la
// valeur de `target`.
const resolvedLink = t.Union([
  t.Object({ target: t.Literal('url'), url: t.String(), newTab: t.Optional(t.Boolean()) }),
  t.Object({
    target: t.String(),
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

// Modèle nommé exposé dans le contrat (components.schemas → type côté @axiome-apps/echoppe-client).
export const menuModels = { Menu: resolvedMenu };
