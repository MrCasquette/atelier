<script setup lang="ts">
import type { Media } from '@/composables/media';
import { getMediaUrl, isImage, isPdf } from '@/composables/media';
import DocumentIcon from '@/components/atoms/icons/DocumentIcon.vue';

defineProps<{
  media: Media;
  maxHeight?: string;
}>();
</script>

<template>
  <div
    class="bg-gray-900 flex items-center justify-center"
    :class="maxHeight || 'min-h-80'"
  >
    <img
      v-if="isImage(media)"
      :src="getMediaUrl(media)"
      :alt="media.alt || ''"
      class="max-w-full max-h-80 object-contain"
    />
    <iframe
      v-else-if="isPdf(media)"
      :src="getMediaUrl(media)"
      class="w-full h-96 bg-white"
      frameborder="0"
    />
    <DocumentIcon
      v-else
      size="lg"
      class="w-20 h-20 text-gray-600"
    />
  </div>
</template>
