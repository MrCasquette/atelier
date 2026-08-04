<script setup lang="ts">
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  variant?: 'default' | 'danger';
  href?: string;
  download?: boolean;
  separator?: boolean;
}

defineProps<{
  x: number;
  y: number;
  items: ContextMenuItem[];
}>();

defineEmits<{
  select: [id: string];
  close: [];
}>();
</script>

<template>
  <div
    class="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-40"
    :style="{ left: `${x}px`, top: `${y}px` }"
  >
    <template
      v-for="item in items"
      :key="item.id"
    >
      <hr
        v-if="item.separator"
        class="my-1 border-gray-200"
      />
      <a
        v-else-if="item.href"
        :href="item.href"
        :download="item.download"
        :class="[
          'w-full px-3 py-1.5 text-left text-sm flex items-center gap-2',
          item.variant === 'danger' ? 'hover:bg-red-50 text-red-600' : 'hover:bg-gray-100'
        ]"
        @click="$emit('close')"
      >
        <slot :name="`icon-${item.id}`" />
        {{ item.label }}
      </a>
      <button
        v-else
        :class="[
          'w-full px-3 py-1.5 text-left text-sm flex items-center gap-2',
          item.variant === 'danger' ? 'hover:bg-red-50 text-red-600' : 'hover:bg-gray-100'
        ]"
        @click="$emit('select', item.id)"
      >
        <slot :name="`icon-${item.id}`" />
        {{ item.label }}
      </button>
    </template>
  </div>
</template>
