import { Elysia } from 'elysia';
import { productCrudRoutes } from './crud';
import { mediaRoutes } from './media';
import { optionRoutes } from './options';
import { personalizationRoutes } from './personalization';
import { publicProductRoutes } from './public';
import { variantRoutes } from './variants';

// `products.ts` était un monolithe (~1350 lignes, 6 sous-ressources). Découpé par sous-ressource
// (public / crud / variants / personnalisation / media / options), composé ici. Contrat d'API et
// matrice RBAC strictement identiques — verrouillés par `tests/products-guards.test.ts`.
export const productsRoutes = new Elysia({ prefix: '/products', detail: { tags: ['Products'] } })
  .use(publicProductRoutes)
  .use(productCrudRoutes)
  .use(variantRoutes)
  .use(personalizationRoutes)
  .use(mediaRoutes)
  .use(optionRoutes);
