<script setup lang="ts">
import type { Media } from '@/composables/media';
import { getMediaUrl, isImage } from '@/composables/media';
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
  <div
    draggable="true"
    :class="[
      'relative cursor-pointer group',
      selected ? 'ring-2 ring-blue-500 ring-offset-1 rounded-lg' : '',
      dragging ? 'opacity-50' : ''
    ]"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend')"
    @click="$emit('click', $event)"
    @dblclick="$emit('dblclick')"
    @contextmenu="$emit('contextmenu', $event)"
  >
    <!-- Square thumbnail -->
    <div class="aspect-square bg-gray-200 rounded-lg overflow-hidden">
      <Thumbnail
        :src="isImage(item) ? getMediaUrl(item) : null"
        :is-image="isImage(item)"
        :alt="item.alt || item.title || ''"
      />
    </div>

    <!-- Title below -->
    <p class="mt-1 text-xs text-gray-700 truncate text-center px-1">
      {{ item.title || item.filenameOriginal }}
    </p>

    <!-- Checkbox -->
    <div
      :class="[
        'absolute top-1 left-1 transition',
        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      ]"
    >
      <Checkbox
        :checked="selected"
        variant="overlay"
        @click="$emit('checkboxClick', $event)"
      />
    </div>
  </div>
</template>
