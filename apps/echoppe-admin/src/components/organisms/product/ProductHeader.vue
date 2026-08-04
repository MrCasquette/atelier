<script setup lang="ts">
import Button from '@/components/atoms/Button.vue';

defineProps<{
  title: string;
  isNew: boolean;
  saving: boolean;
  hasChanges: boolean;
}>();

const emit = defineEmits<{
  back: [];
  save: [];
}>();
</script>

<template>
  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-4">
      <button
        class="p-2 hover:bg-gray-100 rounded-lg transition"
        @click="emit('back')"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
      <h1 class="text-2xl font-bold text-gray-900">
        {{ isNew ? 'Nouveau produit' : title || 'Produit' }}
      </h1>
    </div>
    <Button
      variant="primary"
      size="lg"
      :loading="saving"
      :disabled="!hasChanges || saving"
      @click="emit('save')"
    >
      {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
    </Button>
  </div>
</template>
