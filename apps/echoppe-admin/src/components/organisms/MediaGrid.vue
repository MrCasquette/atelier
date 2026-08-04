<script setup lang="ts">
import { computed } from 'vue';
import type { Media, GridSize } from '@/composables/media';
import MediaGridItem from '@/components/organisms/MediaGridItem.vue';

const props = defineProps<{
  items: Media[];
  selectedIds: Set<string>;
  draggingIds: string[];
  gridSize: GridSize;
}>();

defineEmits<{
  itemClick: [id: string, event: MouseEvent];
  itemDblclick: [item: Media];
  itemContextmenu: [event: MouseEvent, item: Media];
  checkboxClick: [id: string, event: MouseEvent];
  dragstart: [event: DragEvent, id: string];
  dragend: [];
}>();

const gridClasses = computed(() => {
  switch (props.gridSize) {
    case 'small':
      return 'grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12';
    case 'large':
      return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6';
    default:
      return 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10';
  }
});
</script>

<template>
  <div :class="['grid gap-2', gridClasses]">
    <MediaGridItem
      v-for="item in items"
      :key="item.id"
      :item="item"
      :selected="selectedIds.has(item.id)"
      :dragging="draggingIds.includes(item.id)"
      @click="$emit('itemClick', item.id, $event)"
      @dblclick="$emit('itemDblclick', item)"
      @contextmenu="$emit('itemContextmenu', $event, item)"
      @checkbox-click="$emit('checkboxClick', item.id, $event)"
      @dragstart="$emit('dragstart', $event, item.id)"
      @dragend="$emit('dragend')"
    />
  </div>
</template>
