import { Elysia } from 'elysia';
import { customerAccountRoutes } from './account';
import { customerAddressesRoutes } from './address';
import { customersRoutes } from './admin';

// Le client porte TROIS surfaces : sa gestion par l'administration sous `/customers`, son carnet
// d'adresses sous `/customer/addresses` et son compte sous `/customer`.
//
// Son authentification n'est PAS ici : elle appartient au module `auth`, qui répond à « qui es-tu ? »
// pour les deux publics.

export const customerRoutes = new Elysia()
  .use(customersRoutes)
  .use(customerAddressesRoutes)
  .use(customerAccountRoutes);
