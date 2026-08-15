// @repo/menus — la navigation : des liens ordonnés vers ce que le registre de références déclare.
//
// Ni route, ni plugin Elysia, et aucune entité nommée ici : le registre arrive en argument. Voir
// README.md.
export { type MenuItemInput, menuItemsSchema } from './model';
export { type MenuItem, type MenuLink, menu } from './schema';
export {
  type ResolvedMenuItem,
  type ResolvedMenuLink,
  resolveMenuItems,
  unknownTargets,
} from './service';
