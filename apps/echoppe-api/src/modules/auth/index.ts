import { Elysia } from 'elysia';
import { authAdminRoutes } from './admin';
import { customerAuthRoutes } from './customer';

// L'authentification porte DEUX surfaces au même concept : l'administration sous `/auth` et le
// client sous `/customer/auth`. Deux publics, deux cookies, deux tables de session — mais une seule
// question posée, « qui es-tu ? », et un seul module destiné à partir dans `packages/auth`.
//
// Le reste du module n'expose pas de routes : `session.ts` et `customer-session.ts` portent les
// gardes de session, `rbac.ts` les permissions et `src/scripts/create-admin.ts` l'amorçage du propriétaire. Le
// contrat de registre de principaux (ADR-0037) vit dans `@repo/auth`, avec les tables.

export const authRoutes = new Elysia().use(authAdminRoutes).use(customerAuthRoutes);
