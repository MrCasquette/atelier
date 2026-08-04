<script setup lang="ts">
import type { NavigationConfig } from '@/types/navigation';
import SidebarNavSection from '@/components/molecules/SidebarNavSection.vue';

defineProps<{
  navigation: NavigationConfig;
  badgeCounts?: Record<string, number>;
}>();
</script>

<template>
  <nav class="p-4">
    <SidebarNavSection
      v-for="section in navigation"
      :key="section.title"
      :section="section"
      :badge-counts="badgeCounts"
    />
  </nav>
</template>
