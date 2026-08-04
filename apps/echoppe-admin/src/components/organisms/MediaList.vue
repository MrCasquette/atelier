<script setup lang="ts">
import type { Media } from '@/composables/media';
import MediaListRow from '@/components/organisms/MediaListRow.vue';

defineProps<{
  items: Media[];
  selectedIds: Set<string>;
  draggingIds: string[];
}>();

defineEmits<{
  itemClick: [id: string, event: MouseEvent];
  itemDblclick: [item: Media];
  itemContextmenu: [event: MouseEvent, item: Media];
  checkboxClick: [id: string, event: MouseEvent];
  dragstart: [event: DragEvent, id: string];
  dragend: [];
}>();
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <table class="w-full">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr>
          <th class="w-8 px-3 py-2" />
          <th class="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">
            Fichier
          </th>
          <th class="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">
            Type
          </th>
          <th class="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">
            Taille
          </th>
          <th class="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">
            Date
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200">
        <MediaListRow
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
      </tbody>
    </table>
  </div>
</template>
