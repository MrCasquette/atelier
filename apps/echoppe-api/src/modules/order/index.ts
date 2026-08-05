import { Elysia } from 'elysia';
import { ordersRoutes } from './admin';
import { customerOrdersRoutes } from './customer';

// La commande porte DEUX surfaces aux préfixes distincts : la gestion sous `/orders` et la
// consultation par le client de ses propres commandes sous `/customer/orders`. Même concept, mêmes
// données, deux publics et deux gardes — d'où deux contrôleurs, composés ici.

export const orderRoutes = new Elysia().use(ordersRoutes).use(customerOrdersRoutes);
