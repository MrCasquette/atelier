<script setup lang="ts">
import { ref } from 'vue';
import Badge from '@/components/atoms/Badge.vue';
import CloseIcon from '@/components/atoms/icons/CloseIcon.vue';

// Input à puces (B3) : liste de tags éditable. Ajout sur Entrée/virgule, retrait sur clic ou
// Retour arrière quand le champ est vide. Dédup insensible à la casse.
const model = defineModel<string[]>({ required: true });

const draft = ref('');

function addTag() {
  const value = draft.value.trim();
  draft.value = '';
  if (!value) return;
  const exists = model.value.some((t) => t.toLowerCase() === value.toLowerCase());
  if (!exists) model.value = [...model.value, value];
}

function removeTag(index: number) {
  model.value = model.value.filter((_, i) => i !== index);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    addTag();
  } else if (event.key === 'Backspace' && draft.value === '' && model.value.length > 0) {
    removeTag(model.value.length - 1);
  }
}
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
  >
    <Badge
      v-for="(tag, index) in model"
      :key="tag"
      variant="default"
      size="sm"
      class="flex items-center gap-1"
    >
      {{ tag }}
      <button
        type="button"
        class="text-gray-400 hover:text-red-600 cursor-pointer"
        :aria-label="`Retirer ${tag}`"
        @click="removeTag(index)"
      >
        <CloseIcon class="w-3 h-3" />
      </button>
    </Badge>
    <input
      v-model="draft"
      type="text"
      class="flex-1 min-w-32 border-none outline-none text-sm py-0.5"
      placeholder="Ajouter un tag…"
      @keydown="onKeydown"
      @blur="addTag"
    />
  </div>
</template>
