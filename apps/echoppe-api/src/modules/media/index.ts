import { Elysia } from 'elysia';
import { assetsRoutes } from './asset';
import { mediaFolderRoutes } from './folder';
import { mediaItemRoutes } from './item';

// Le média porte TROIS contrôleurs. Ici le découpage ne suit pas l'audience (comme `page` ou
// `menu`) mais le sous-concept : l'arborescence, les fichiers, et leur livraison publique.
//
// L'ordre compte : `/media/folders` doit être déclaré avant `/media/:id`.

export const mediaRoutes = new Elysia()
  .use(mediaFolderRoutes)
  .use(mediaItemRoutes)
  .use(assetsRoutes);
