<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/lib/api';
import CloseIcon from '@/components/atoms/icons/CloseIcon.vue';
import EditIcon from '@/components/atoms/icons/EditIcon.vue';
import ImageIcon from '@/components/atoms/icons/ImageIcon.vue';
import MediaBrowserModal from '@/components/organisms/MediaBrowserModal.vue';
import { type Media, getMediaUrl } from '@/composables/media';

const props = defineProps<{
  modelValue: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const showPicker = ref(false);
const selectedMedia = ref<Media | null>(null);

async function loadSelected() {
  if (props.modelValue) {
    const { data } = await api.media({ id: props.modelValue }).get();
    if (data && 'id' in data) selectedMedia.value = data as Media;
  }
}

onMounted(loadSelected);

function openPicker() {
  showPicker.value = true;
}

function handleSelect(media: Media) {
  selectedMedia.value = media;
  emit('update:modelValue', media.id);
  showPicker.value = false;
}

function clearMedia() {
  selectedMedia.value = null;
  emit('update:modelValue', null);
}

function closePicker() {
  showPicker.value = false;
}
</script>

<template>
  <div>
    <!-- Selected preview -->
    <div
      v-if="selectedMedia"
      class="relative w-32 h-32 bg-gray-100 rounded-lg overflow-hidden group"
    >
      <img
        :src="getMediaUrl(selectedMedia)"
        class="w-full h-full object-cover"
      />
      <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition">
        <button
          type="button"
          class="p-2 bg-white rounded-full"
          @click="openPicker"
        >
          <EditIcon size="sm" />
        </button>
        <button
          type="button"
          class="p-2 bg-white rounded-full"
          @click="clearMedia"
        >
          <CloseIcon
            size="sm"
            class="text-red-500"
          />
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <button
      v-else
      type="button"
      class="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition"
      @click="openPicker"
    >
      <ImageIcon
        size="lg"
        class="w-8 h-8 mb-1"
      />
      <span class="text-xs">Choisir</span>
    </button>

    <!-- Media Browser Modal -->
    <MediaBrowserModal
      v-if="showPicker"
      title="Choisir une image"
      accept="images"
      :on-select="handleSelect"
      :on-close="closePicker"
    />
  </div>
</template>
