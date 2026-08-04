<script setup lang="ts">
import type { NavSection } from '@/types/navigation';
import SidebarNavItem from '@/components/molecules/SidebarNavItem.vue';

defineProps<{
  section: NavSection;
  badgeCounts?: Record<string, number>;
}>();
</script>

<template>
  <div class="mb-6 last:mb-0">
    <h3
      v-if="section.title"
      class="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider"
    >
      {{ section.title }}
    </h3>
    <div class="space-y-1">
      <SidebarNavItem
        v-for="item in section.items"
        :key="item.path"
        :item="item"
        :badge-count="item.badge ? badgeCounts?.[item.badge.key] : undefined"
      />
    </div>
  </div>
</template>
