import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { securityHeaders } from './plugins/security-headers';
import { apiKeyRoutes } from './routes/api-keys';
import { assetsRoutes } from './routes/assets';
import { auditLogsRoutes } from './routes/audit-logs';
import { authRoutes } from './routes/auth';
import { cartRoutes } from './routes/cart';
import { categoriesRoutes } from './routes/categories';
import { checkoutRoutes } from './routes/checkout';
import { collectionsRoutes } from './routes/collections';
import { communicationsRoutes } from './routes/communications';
import { companyRoutes } from './routes/company';
import { contactRoutes } from './routes/contact';
import { contentRoutes } from './routes/content';
import { countriesRoutes } from './routes/countries';
import { customerAccountRoutes } from './routes/customer-account';
import { customerAddressesRoutes } from './routes/customer-addresses';
import { customerAuthRoutes } from './routes/customer-auth';
import { customerOrdersRoutes } from './routes/customer-orders';
import { customersRoutes } from './routes/customers';
import { mediaRoutes } from './routes/media';
import { menusRoutes } from './routes/menus';
import { optionsRoutes } from './routes/options';
import { ordersRoutes } from './routes/orders';
import { pagesRoutes } from './routes/pages';
import { paymentsRoutes } from './routes/payments';
import { productsRoutes } from './routes/products';
import { rolesRoutes } from './routes/roles';
import { shippingRoutes } from './routes/shipping';
import { stockRoutes } from './routes/stock';
import { taxRatesRoutes } from './routes/tax-rates';
import { usersRoutes } from './routes/users';
import { wishlistRoutes } from './routes/wishlist';

// Application Elysia PURE : construction des routes/plugins, sans aucun side-effect de
// bootstrap (pas de listen, migrations, initAdmin ni intervals — cf. index.ts). Importable
// tel quel dans les tests via `app.handle(request)`.
export const app = new Elysia()
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
  .use(customerAuthRoutes)
  .use(categoriesRoutes)
  .use(productsRoutes)
  .use(optionsRoutes)
  .use(pagesRoutes)
  .use(menusRoutes)
  .use(contentRoutes)
  .use(apiKeyRoutes)
  .use(mediaRoutes)
  .use(collectionsRoutes)
  .use(taxRatesRoutes)
  .use(countriesRoutes)
  .use(assetsRoutes)
  .use(companyRoutes)
  .use(stockRoutes)
  .use(paymentsRoutes)
  .use(shippingRoutes)
  .use(ordersRoutes)
  .use(rolesRoutes)
  .use(cartRoutes)
  .use(customerAddressesRoutes)
  .use(customerOrdersRoutes)
  .use(customerAccountRoutes)
  .use(checkoutRoutes)
  .use(communicationsRoutes)
  .use(customersRoutes)
  .use(wishlistRoutes)
  .use(usersRoutes)
  .use(contactRoutes)
  .use(auditLogsRoutes);

export type App = typeof app;
