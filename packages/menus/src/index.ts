// @repo/menus — la navigation : des liens ordonnés vers ce que le registre de références déclare.
//
// Les DÉFINITIONS de tables sont livrées comme définitions : chaque cœur les inclut dans son barrel
// et donc dans ses migrations (ADR-0025). Aucune route, aucun plugin Elysia — le contrat de lecture
// front appartient au produit, parce qu'il décrit ce qu'une route rend (ADR-0044).
export { type MenuItemInput, menuItemsSchema } from './model';
export { type MenuItem, type MenuLink, menu } from './schema';
export {
  type ResolvedMenuItem,
  type ResolvedMenuLink,
  resolveMenuItems,
  unknownTargets,
} from './service';
