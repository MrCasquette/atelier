<script setup lang="ts">
export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

defineProps<{
  items: BreadcrumbItem[];
}>();

defineEmits<{
  navigate: [id: string | null];
}>();
</script>

<template>
  <div class="flex items-center gap-1 text-sm min-w-0">
    <template
      v-for="(item, index) in items"
      :key="item.id ?? 'root'"
    >
      <span
        v-if="index > 0"
        class="text-gray-400"
      >/</span>
      <button
        :class="[
          'hover:text-blue-600 truncate',
          index === items.length - 1 ? 'text-gray-900 font-medium' : 'text-gray-500'
        ]"
        @click="$emit('navigate', item.id)"
      >
        {{ item.name }}
      </button>
    </template>
  </div>
</template>
