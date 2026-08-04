<script setup lang="ts">
withDefaults(
  defineProps<{
    fromValue: string;
    toValue: string;
    label: string;
    fromPlaceholder?: string;
    toPlaceholder?: string;
  }>(),
  {
    fromPlaceholder: 'Date debut',
    toPlaceholder: 'Date fin',
  }
);

defineEmits<{
  'update:fromValue': [value: string];
  'update:toValue': [value: string];
}>();
</script>

<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1">
      {{ label }}
    </label>
    <div class="flex gap-2">
      <input
        type="date"
        :value="fromValue"
        :placeholder="fromPlaceholder"
        class="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        @input="$emit('update:fromValue', ($event.target as HTMLInputElement).value)"
      />
      <input
        type="date"
        :value="toValue"
        :placeholder="toPlaceholder"
        class="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        @input="$emit('update:toValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>
