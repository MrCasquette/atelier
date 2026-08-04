<script setup lang="ts">
import Button from '@/components/atoms/Button.vue';
import MenuItemRow from './MenuItemRow.vue';
import { emptyMenuItem } from '@/composables/content/menuFactory';
import type { MenuItem } from '@/composables/content/menuTypes';

// Liste ordonnée d'items de menu (un niveau). Récursif : chaque MenuItemRow contient lui-même un
// MenuItemTree pour ses enfants. Opérations immuables sur le v-model.
const items = defineModel<MenuItem[]>({ required: true });

function add() {
  items.value = [...items.value, emptyMenuItem()];
}

function updateAt(index: number, item: MenuItem) {
  const next = items.value.slice();
  next[index] = item;
  items.value = next;
}

function removeAt(index: number) {
  items.value = items.value.filter((_, i) => i !== index);
}

function move(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.value.length) return;
  const next = items.value.slice();
  [next[index], next[target]] = [next[target], next[index]];
  items.value = next;
}
</script>

<template>
  <div class="space-y-2">
    <MenuItemRow
      v-for="(item, index) in items"
      :key="index"
      :model-value="item"
      :is-first="index === 0"
      :is-last="index === items.length - 1"
      @update:model-value="updateAt(index, $event)"
      @remove="removeAt(index)"
      @move-up="move(index, -1)"
      @move-down="move(index, 1)"
    />
    <Button
      variant="secondary"
      size="sm"
      @click="add"
    >
      + Ajouter un item
    </Button>
  </div>
</template>
