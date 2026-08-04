<script setup lang="ts">
withDefaults(
  defineProps<{
    minValue: string;
    maxValue: string;
    label: string;
    minPlaceholder?: string;
    maxPlaceholder?: string;
    step?: number;
  }>(),
  {
    minPlaceholder: 'Min',
    maxPlaceholder: 'Max',
    step: 1,
  }
);

defineEmits<{
  'update:minValue': [value: string];
  'update:maxValue': [value: string];
}>();
</script>

<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1">
      {{ label }}
    </label>
    <div class="flex gap-2">
      <input
        type="number"
        :value="minValue"
        :placeholder="minPlaceholder"
        :step="step"
        class="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        @input="$emit('update:minValue', ($event.target as HTMLInputElement).value)"
      />
      <input
        type="number"
        :value="maxValue"
        :placeholder="maxPlaceholder"
        :step="step"
        class="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        @input="$emit('update:maxValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>
