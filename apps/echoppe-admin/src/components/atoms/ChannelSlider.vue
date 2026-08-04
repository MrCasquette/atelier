<script setup lang="ts">
// Un canal éditable : slider + saisie numérique inline (précision). Utilisé par le ColorPicker
// pour les modes RGBA / OKLCH.
defineProps<{
  label: string;
  min: number;
  max: number;
  step: number;
  modelValue: number;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

function onInput(event: Event) {
  const n = Number((event.target as HTMLInputElement).value);
  if (!Number.isNaN(n)) emit('update:modelValue', n);
}
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="w-8 text-xs font-medium text-gray-500 shrink-0">{{ label }}</span>
    <input
      class="flex-1 h-2 appearance-none rounded-full bg-gray-200 cursor-pointer accent-blue-600 min-w-0"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @input="onInput"
    />
    <input
      class="w-16 shrink-0 px-1.5 py-1 text-xs font-mono text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      type="number"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @change="onInput"
    />
  </div>
</template>
