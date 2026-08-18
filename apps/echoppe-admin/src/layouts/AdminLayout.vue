<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useEntities } from '@/composables/entities/useEntities';
import { api } from '@/lib/api';
import type { NavigationConfig, NavSection } from '@/types/navigation';
import SidebarNav from '@/components/organisms/SidebarNav.vue';
import SidebarUserMenu from '@/components/molecules/SidebarUserMenu.vue';
import type { ApiData } from '@/types/api';

import { API_BASE } from '@/lib/api-base';

const router = useRouter();
const auth = useAuth();

type Identity = ApiData<ReturnType<typeof api.identity.get>>;
const identity = ref<Identity | null>(null);

const siteName = computed(() => identity.value?.site?.name || 'Échoppe');
const logoUrl = computed(() =>
  identity.value?.site?.logo ? `${API_BASE}/assets/${identity.value.site.logo}` : null,
);

const { entities, load: loadEntities } = useEntities();

onMounted(async () => {
  const { data } = await api.identity.get();
  if (data) identity.value = data;
  await loadEntities();
});

async function handleLogout() {
  await auth.logout();
  router.push('/login');
}

const staticNavigation: NavigationConfig = [
  {
    title: '',
    items: [
      {
        name: 'Tableau de bord',
        path: '/',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      },
    ],
  },
  {
    title: 'CATALOGUE',
    items: [
      {
        name: 'Produits',
        path: '/produits',
        icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
        badge: { key: 'outOfStock', variant: 'warning' },
      },
      {
        name: 'Organisation',
        path: '/taxonomie',
        icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z',
      },
      {
        name: 'Stock',
        path: '/stock',
        icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4',
      },
    ],
  },
  {
    title: 'COMMANDES',
    items: [
      {
        name: 'Commandes',
        path: '/commandes',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
        badge: { key: 'pendingOrders', variant: 'info' },
      },
      {
        name: 'Clients',
        path: '/clients',
        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      },
      {
        name: 'Prestataires',
        path: '/prestataires',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      },
    ],
  },
  {
    title: 'CONTENU',
    items: [
      {
        name: 'Pages',
        path: '/contenu',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      },
      {
        name: 'Menus',
        path: '/menus',
        icon: 'M4 6h16M4 12h16M4 18h16',
      },
      {
        name: 'Médiathèque',
        path: '/medias',
        icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      },
    ],
  },
  {
    title: 'CONFIGURATION',
    items: [
      {
        name: 'Paramètres',
        path: '/parametres',
        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
      },
      {
        name: 'Journal d\'audit',
        path: '/audit',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      },
    ],
  },
];

// Les entités déclarées entrent dans la navigation avec le libellé et l'icône que le dev leur a
// donnés. Rien n'est codé ici : la section n'apparaît que si l'installation en déclare, et n'y
// figure que ce que l'utilisateur détient — la liste vient de `/content/entities/mine`.
const DEFAULT_ENTITY_ICON =
  'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4';

const entitiesSection = computed<NavSection[]>(() => {
  if (entities.value.length === 0) return [];
  return [
    {
      title: 'ENTITÉS',
      items: entities.value.map((entity) => ({
        name: entity.label ?? entity.name,
        path: `/entites/${entity.name}`,
        icon: entity.icon ?? DEFAULT_ENTITY_ICON,
      })),
    },
  ];
});

// Les entités se rangent après le contenu, avant la configuration : ce sont du contenu, et la
// configuration doit rester en bas.
const navigationConfig = computed<NavigationConfig>(() => {
  const configuration = staticNavigation.at(-1);
  return [
    ...staticNavigation.slice(0, -1),
    ...entitiesSection.value,
    ...(configuration ? [configuration] : []),
  ];
});

const badgeCounts = ref<Record<string, number>>({
  outOfStock: 0,
  pendingOrders: 0,
});
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <!-- Sidebar -->
    <aside class="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col">
      <!-- Logo + Shop name -->
      <div class="flex items-center gap-3 h-16 px-6 border-b border-gray-200 shrink-0">
        <div
          v-if="logoUrl"
          class="w-8 h-8 rounded-lg overflow-hidden shrink-0"
        >
          <img
            :src="logoUrl"
            :alt="siteName"
            class="w-full h-full object-cover"
          />
        </div>
        <div
          v-else
          class="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0"
        >
          <svg
            class="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </div>
        <h1 class="text-lg font-semibold text-gray-900 truncate">
          {{ siteName }}
        </h1>
      </div>

      <!-- Navigation scrollable -->
      <div class="flex-1 overflow-y-auto">
        <SidebarNav
          :navigation="navigationConfig"
          :badge-counts="badgeCounts"
        />
      </div>

      <!-- User menu -->
      <SidebarUserMenu
        v-if="auth.user.value"
        :first-name="auth.user.value.firstName"
        :last-name="auth.user.value.lastName"
        @logout="handleLogout"
      />
    </aside>

    <!-- Main content -->
    <main class="ml-64 p-6">
      <router-view />
    </main>
  </div>
</template>
