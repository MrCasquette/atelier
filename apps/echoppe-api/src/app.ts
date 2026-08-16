import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { errorHandler } from './error-handler';
import { apiKeyRoutes } from './modules/api-key';
import { auditLogsRoutes } from './modules/audit';
import { authRoutes } from './modules/auth';
import { cartRoutes } from './modules/cart';
import { categoriesRoutes } from './modules/catalog/category';
import { collectionsRoutes } from './modules/catalog/collection';
import { optionsRoutes } from './modules/catalog/option';
import { productsRoutes } from './modules/catalog/product';
import { checkoutRoutes } from './modules/checkout';
import { communicationsRoutes } from './modules/communication';
import { contactRoutes } from './modules/contact';
import { definitionRoutes } from './modules/content/definition';
import { entityRoutes } from './modules/content/entity';
import { entityAdminRoutes } from './modules/content/entity/admin';
import { entityMineRoutes } from './modules/content/entity/mine';
import { entityPublicRoutes } from './modules/content/entity/public';
import { pageRoutes } from './modules/content/page';
import { countriesRoutes } from './modules/country';
import { customerRoutes } from './modules/customer';
import { identityRoutes } from './modules/identity';
import { mediaRoutes } from './modules/media';
import { menuRoutes } from './modules/menu';
import { orderRoutes } from './modules/order';
import { paymentsRoutes } from './modules/payment';
import { referenceRoutes } from './modules/reference';
import { rolesRoutes } from './modules/role';
import { shippingRoutes } from './modules/shipping';
import { stockRoutes } from './modules/stock';
import { taxRatesRoutes } from './modules/tax-rate';
import { usersRoutes } from './modules/user';
import { wishlistRoutes } from './modules/wishlist';
import { securityHeaders } from './security-headers';

// Application Elysia PURE : construction des routes/plugins, sans aucun side-effect de
// bootstrap (pas de listen, migrations, initAdmin ni intervals — cf. index.ts). Importable
// tel quel dans les tests via `app.handle(request)`.
export const app = new Elysia()
  // En premier : le gestionnaire doit couvrir tout ce qui est monté ensuite.
  .use(errorHandler)
  .use(securityHeaders)
  .use(
    cors({
      origin: [
        process.env.ADMIN_URL || 'http://localhost:3211',
        process.env.STORE_URL || 'http://localhost:3141',
      ],
      credentials: true,
    }),
  )
  .use(
    openapi({
      path: '/docs',
      scalar: {
        theme: 'bluePlanet',
        darkMode: true,
        customCss: `.dark-mode { --scalar-color-accent: #ffffff !important; }`,
      },
      documentation: {
        info: {
          title: 'Échoppe API',
          version: '1.0.0',
          description: 'API e-commerce pour artisans français',
        },
        tags: [
          { name: 'General', description: 'Informations générales' },
          { name: 'Auth', description: 'Authentification admin' },
          { name: 'Customer Auth', description: 'Authentification client' },
          { name: 'Products', description: 'Gestion des produits' },
          { name: 'Categories', description: 'Gestion des catégories' },
          { name: 'Collections', description: 'Gestion des collections' },
          { name: 'Media', description: 'Médiathèque' },
          { name: 'Orders', description: 'Commandes' },
          { name: 'Stock', description: 'Gestion du stock' },
          { name: 'Payments', description: 'Paiements' },
          { name: 'Shipping', description: 'Livraison' },
          { name: 'Company', description: 'Informations entreprise' },
          { name: 'Tax Rates', description: 'Taux de TVA' },
          { name: 'Assets', description: 'Fichiers statiques' },
          { name: 'Roles', description: 'Gestion des rôles et permissions' },
          { name: 'Cart', description: 'Panier client' },
          { name: 'Wishlist', description: 'Liste d’envies client' },
          { name: 'Customer Addresses', description: 'Adresses client' },
          { name: 'Checkout', description: 'Tunnel de paiement' },
          { name: 'Communications', description: 'Configuration emails' },
          { name: 'Customers', description: 'Gestion des clients' },
          { name: 'Users', description: 'Gestion des utilisateurs admin' },
          { name: 'Contact', description: 'Formulaire de contact' },
          { name: 'Audit', description: "Journal d'audit" },
        ],
      },
    }),
  )
  .get(
    '/',
    () => ({
      name: 'Échoppe API',
      version: '1.0.0',
    }),
    { detail: { tags: ['General'], summary: 'Informations API' } },
  )
  .get(
    '/health',
    () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
    { detail: { tags: ['General'], summary: 'Health check' } },
  )
  .use(authRoutes)
  .use(categoriesRoutes)
  .use(productsRoutes)
  .use(optionsRoutes)
  .use(menuRoutes)
  .use(definitionRoutes)
  .use(entityRoutes)
  .use(entityMineRoutes)
  .use(entityAdminRoutes)
  .use(entityPublicRoutes)
  .use(referenceRoutes)
  .use(pageRoutes)
  .use(apiKeyRoutes)
  .use(mediaRoutes)
  .use(collectionsRoutes)
  .use(taxRatesRoutes)
  .use(countriesRoutes)
  .use(identityRoutes)
  .use(stockRoutes)
  .use(paymentsRoutes)
  .use(shippingRoutes)
  .use(orderRoutes)
  .use(rolesRoutes)
  .use(cartRoutes)
  .use(checkoutRoutes)
  .use(communicationsRoutes)
  .use(customerRoutes)
  .use(wishlistRoutes)
  .use(usersRoutes)
  .use(contactRoutes)
  .use(auditLogsRoutes);

export type App = typeof app;
