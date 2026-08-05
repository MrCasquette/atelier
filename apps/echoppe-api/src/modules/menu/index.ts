import { Elysia } from 'elysia';
import { menuAdminRoutes } from './admin';
import { menusRoutes } from './public';

// Le menu porte DEUX surfaces aux préfixes distincts : l'administration sous `/content` (il partage
// l'écran du page builder) et la lecture storefront sous `/menus`. Chaque fichier déclare UNE
// instance Elysia — « 1 instance = 1 controller » — et ce module les compose.

export const menuRoutes = new Elysia().use(menuAdminRoutes).use(menusRoutes);
