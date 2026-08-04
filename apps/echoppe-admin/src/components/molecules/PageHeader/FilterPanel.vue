<script setup lang="ts">
import Button from '@/components/atoms/Button.vue';

defineEmits<{
  apply: [];
  reset: [];
}>();
</script>

<template>
  <div class="p-4 bg-white border border-gray-200 rounded-lg">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <slot />
    </div>

    <div class="flex justify-end gap-2 mt-4">
      <slot name="actions">
        <Button
          variant="secondary"
          @click="$emit('reset')"
        >
          Reinitialiser
        </Button>
        <Button
          variant="primary"
          @click="$emit('apply')"
        >
          Appliquer
        </Button>
      </slot>
    </div>
  </div>
</template>
