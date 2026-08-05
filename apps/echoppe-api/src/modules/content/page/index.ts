import { Elysia } from 'elysia';
import { pageAdminRoutes } from './admin';
import { pagesRoutes } from './public';

// Le page builder porte DEUX surfaces aux préfixes distincts : l'administration sous `/content`
// et la lecture storefront sous `/pages`. Chaque fichier déclare UNE instance Elysia — « 1 instance
// = 1 controller » — et ce module les compose.

export const pageRoutes = new Elysia().use(pageAdminRoutes).use(pagesRoutes);
