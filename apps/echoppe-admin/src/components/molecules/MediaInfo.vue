<script setup lang="ts">
import type { Media } from '@/composables/media';
import { formatSize } from '@/composables/media';

defineProps<{
  media: Media;
}>();
</script>

<template>
  <dl class="space-y-2 text-xs">
    <div class="flex justify-between">
      <dt class="text-gray-500">
        ID
      </dt>
      <dd class="font-mono text-gray-700 select-all">
        {{ media.id }}
      </dd>
    </div>
    <div class="flex justify-between">
      <dt class="text-gray-500">
        Fichier
      </dt>
      <dd class="text-gray-700 truncate ml-4 max-w-32">
        {{ media.filenameOriginal }}
      </dd>
    </div>
    <div class="flex justify-between">
      <dt class="text-gray-500">
        Disque
      </dt>
      <dd class="font-mono text-gray-700 select-all text-[10px]">
        {{ media.filenameDisk }}
      </dd>
    </div>
    <div class="flex justify-between">
      <dt class="text-gray-500">
        Type
      </dt>
      <dd class="text-gray-700">
        {{ media.mimeType }}
      </dd>
    </div>
    <div class="flex justify-between">
      <dt class="text-gray-500">
        Taille
      </dt>
      <dd class="text-gray-700">
        {{ formatSize(media.size) }}
      </dd>
    </div>
    <div
      v-if="media.width && media.height"
      class="flex justify-between"
    >
      <dt class="text-gray-500">
        Dimensions
      </dt>
      <dd class="text-gray-700">
        {{ media.width }} x {{ media.height }}
      </dd>
    </div>
  </dl>
</template>
