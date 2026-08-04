<script setup lang="ts">
import type { NavItem } from '@/types/navigation';
import Badge from '@/components/atoms/Badge.vue';

defineProps<{
  item: NavItem;
  badgeCount?: number;
}>();
</script>

<template>
  <router-link
    :to="item.path"
    class="flex items-center px-4 py-2.5 text-gray-700 rounded-lg hover:bg-gray-100 transition"
    active-class="bg-blue-50 text-blue-700"
  >
    <svg
      class="w-5 h-5 mr-3 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        :d="item.icon"
      />
    </svg>
    <span class="flex-1">{{ item.name }}</span>
    <Badge
      v-if="badgeCount !== undefined && badgeCount > 0"
      :variant="item.badge?.variant ?? 'default'"
      size="sm"
    >
      {{ badgeCount > 99 ? '99+' : badgeCount }}
    </Badge>
  </router-link>
</template>
