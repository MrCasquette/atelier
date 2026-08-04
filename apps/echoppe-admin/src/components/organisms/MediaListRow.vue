<script setup lang="ts">
import type { Media } from '@/composables/media';
import { getMediaUrl, isImage, formatSize, formatDate } from '@/composables/media';
import Checkbox from '@/components/atoms/Checkbox.vue';
import Thumbnail from '@/components/atoms/Thumbnail.vue';

defineProps<{
  item: Media;
  selected: boolean;
  dragging: boolean;
}>();

defineEmits<{
  click: [event: MouseEvent];
  dblclick: [];
  contextmenu: [event: MouseEvent];
  checkboxClick: [event: MouseEvent];
  dragstart: [event: DragEvent];
  dragend: [];
}>();
</script>

<template>
  <tr
    draggable="true"
    :class="[
      'cursor-pointer transition',
      selected ? 'bg-blue-50' : 'hover:bg-gray-50',
      dragging ? 'opacity-50' : ''
    ]"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend')"
    @click="$emit('click', $event)"
    @dblclick="$emit('dblclick')"
    @contextmenu="$emit('contextmenu', $event)"
  >
    <td class="px-3 py-2">
      <Checkbox
        :checked="selected"
        size="sm"
        @click="$emit('checkboxClick', $event)"
      />
    </td>
    <td class="px-3 py-2">
      <div class="flex items-center gap-3">
        <Thumbnail
          :src="isImage(item) ? getMediaUrl(item) : null"
          :is-image="isImage(item)"
          size="sm"
        />
        <div class="min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">
            {{ item.title || item.filenameOriginal }}
          </p>
          <p class="text-xs text-gray-500 truncate">
            {{ item.filenameOriginal }}
          </p>
        </div>
      </div>
    </td>
    <td class="px-3 py-2 text-sm text-gray-600">
      {{ item.mimeType.split('/')[1] }}
    </td>
    <td class="px-3 py-2 text-sm text-gray-600">
      {{ formatSize(item.size) }}
    </td>
    <td class="px-3 py-2 text-sm text-gray-600">
      {{ formatDate(item.dateCreated) }}
    </td>
  </tr>
</template>
