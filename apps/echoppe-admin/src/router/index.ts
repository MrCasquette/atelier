import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      // Où l'invité pose son mot de passe (ADR-0048). PUBLIQUE : il n'a pas encore de compte
      // utilisable, donc pas de session — l'y envoyer serait un cercle.
      path: '/invitation',
      name: 'invitation',
      component: () => import('../views/InvitationView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      component: () => import('../layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('../views/DashboardView.vue'),
        },
        {
          path: 'produits',
          name: 'products',
          component: () => import('../views/ProductsView.vue'),
        },
        {
          path: 'produits/:id',
          name: 'product-edit',
          component: () => import('../views/ProductEditView.vue'),
        },
        {
          path: 'taxonomie',
          name: 'taxonomy',
          component: () => import('../views/TaxonomyView.vue'),
        },
        {
          path: 'medias',
          name: 'media',
          component: () => import('../views/MediaView.vue'),
        },
        {
          path: 'contenu',
          name: 'content-pages',
          component: () => import('../views/PagesView.vue'),
        },
        {
          path: 'contenu/:id',
          name: 'content-page-edit',
          component: () => import('../views/PageEditView.vue'),
        },
        {
          path: 'menus',
          name: 'content-menus',
          component: () => import('../views/MenusView.vue'),
        },
        {
          path: 'menus/:id',
          name: 'content-menu-edit',
          component: () => import('../views/MenuEditView.vue'),
        },
        // Entités déclarées : une seule paire d'écrans pour toutes. Ce qu'elles ont de propre —
        // champs, cardinalité, libellé — vient de leur déclaration, jamais d'une route dédiée.
        {
          path: 'entites/:name',
          name: 'entity',
          component: () => import('../views/EntityView.vue'),
        },
        {
          path: 'entites/:name/nouveau',
          name: 'entity-row-new',
          component: () => import('../views/EntityRowEditView.vue'),
        },
        {
          path: 'entites/:name/:id',
          name: 'entity-row-edit',
          component: () => import('../views/EntityRowEditView.vue'),
        },
        {
          path: 'stock',
          name: 'stock',
          component: () => import('../views/StockView.vue'),
        },
        {
          path: 'commandes',
          name: 'orders',
          component: () => import('../views/OrdersView.vue'),
        },
        {
          path: 'commandes/:id',
          name: 'order-detail',
          component: () => import('../views/OrderDetailView.vue'),
        },
        {
          path: 'prestataires',
          name: 'providers',
          component: () => import('../views/ProvidersView.vue'),
        },
        {
          path: 'profil',
          name: 'profile',
          component: () => import('../views/ProfileView.vue'),
        },
        {
          path: 'parametres',
          name: 'settings',
          component: () => import('../views/SettingsView.vue'),
        },
        {
          path: 'roles',
          redirect: '/parametres?tab=roles',
        },
        {
          path: 'roles/nouveau',
          name: 'role-new',
          component: () => import('../views/RoleEditView.vue'),
        },
        {
          path: 'roles/:id',
          name: 'role-edit',
          component: () => import('../views/RoleEditView.vue'),
        },
        {
          path: 'clients',
          name: 'customers',
          component: () => import('../views/CustomersView.vue'),
        },
        {
          path: 'clients/:id',
          name: 'customer-detail',
          component: () => import('../views/CustomerDetailView.vue'),
        },
        {
          path: 'utilisateurs',
          redirect: '/parametres?tab=users',
        },
        {
          path: 'utilisateurs/nouveau',
          name: 'user-create',
          component: () => import('../views/UserEditView.vue'),
        },
        {
          path: 'utilisateurs/:id',
          name: 'user-edit',
          component: () => import('../views/UserEditView.vue'),
        },
        {
          path: 'audit',
          name: 'audit',
          component: () => import('../views/AuditLogsView.vue'),
        },
      ],
    },
  ],
});

router.beforeEach(async (to, _from, next) => {
  const auth = useAuth();

  // Check auth status on first load
  if (auth.loading.value) {
    await auth.checkAuth();
  }

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth !== false);

  if (requiresAuth && !auth.isAuthenticated.value) {
    next({ name: 'login', query: { redirect: to.fullPath } });
  } else if (to.name === 'login' && auth.isAuthenticated.value) {
    next({ name: 'dashboard' });
  } else {
    next();
  }
});

export default router;
