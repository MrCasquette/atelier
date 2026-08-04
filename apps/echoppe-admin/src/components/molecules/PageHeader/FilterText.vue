<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    placeholder?: string;
  }>(),
  {
    placeholder: '',
  }
);

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1">
      {{ label }}
    </label>
    <input
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
