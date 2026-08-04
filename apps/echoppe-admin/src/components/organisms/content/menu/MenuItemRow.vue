<script setup lang="ts">
import { ref } from 'vue';
import IconButton from '@/components/atoms/IconButton.vue';
import Input from '@/components/atoms/Input.vue';
import MenuItemTree from './MenuItemTree.vue';
import MenuLinkEditor from './MenuLinkEditor.vue';
import type { MenuItem } from '@/composables/content/menuTypes';

// Un nœud de l'arbre de menu : libellé + lien + ses sous-items (récursion via MenuItemTree). Mise à
// jour immuable (émet un nouvel item). La récursion illimitée = ce composant se rend lui-même via
// MenuItemTree pour `children`.
const props = defineProps<{
  modelValue: MenuItem;
  isFirst: boolean;
  isLast: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: MenuItem];
  remove: [];
  moveUp: [];
  moveDown: [];
}>();

const collapsed = ref(false);

function patch(patchObj: Partial<MenuItem>) {
  emit('update:modelValue', { ...props.modelValue, ...patchObj });
}
</script>

<template>
  <div class="rounded-md border border-gray-200 bg-white">
    <div class="flex items-center gap-2 px-3 py-2">
      <IconButton
        :aria-label="collapsed ? 'Déplier' : 'Replier'"
        @click="collapsed = !collapsed"
      >
        {{ collapsed ? '▸' : '▾' }}
      </IconButton>
      <Input
        :model-value="modelValue.label"
        placeholder="Libellé de l'item"
        size="sm"
        class="flex-1"
        @update:model-value="patch({ label: $event })"
      />
      <IconButton
        aria-label="Monter"
        :disabled="isFirst"
        @click="emit('moveUp')"
      >
        ↑
      </IconButton>
      <IconButton
        aria-label="Descendre"
        :disabled="isLast"
        @click="emit('moveDown')"
      >
        ↓
      </IconButton>
      <IconButton
        variant="danger"
        aria-label="Supprimer"
        @click="emit('remove')"
      >
        ✕
      </IconButton>
    </div>

    <div
      v-if="!collapsed"
      class="space-y-3 px-3 pb-3"
    >
      <MenuLinkEditor
        :model-value="modelValue.link"
        @update:model-value="patch({ link: $event })"
      />

      <div class="border-l-2 border-gray-100 pl-3">
        <p class="mb-2 text-xs font-medium text-gray-400">
          Sous-items
        </p>
        <MenuItemTree
          :model-value="modelValue.children"
          @update:model-value="patch({ children: $event })"
        />
      </div>
    </div>
  </div>
</template>
