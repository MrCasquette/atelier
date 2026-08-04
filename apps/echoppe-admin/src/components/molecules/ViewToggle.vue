<script setup lang="ts">
import GridIcon from '@/components/atoms/icons/GridIcon.vue';
import ListIcon from '@/components/atoms/icons/ListIcon.vue';

defineProps<{
  modelValue: 'grid' | 'list';
}>();

defineEmits<{
  'update:modelValue': [value: 'grid' | 'list'];
}>();
</script>

<template>
  <div class="flex border border-gray-300 rounded-lg overflow-hidden">
    <button
      :class="['p-1.5', modelValue === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50']"
      title="Vue grille"
      @click="$emit('update:modelValue', 'grid')"
    >
      <GridIcon size="sm" />
    </button>
    <button
      :class="['p-1.5', modelValue === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50']"
      title="Vue liste"
      @click="$emit('update:modelValue', 'list')"
    >
      <ListIcon size="sm" />
    </button>
  </div>
</template>
