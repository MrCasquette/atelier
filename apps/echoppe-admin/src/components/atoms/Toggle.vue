<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md';
  }>(),
  {
    disabled: false,
    size: 'md',
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const track = { sm: 'w-8 h-4.5', md: 'w-10 h-6' };
const knob = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5' };
const travel = { sm: 'translate-x-3.5', md: 'translate-x-4' };
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    :class="[
      'relative inline-flex items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
      track[size],
      modelValue ? 'bg-blue-600' : 'bg-gray-300',
      disabled && 'cursor-not-allowed opacity-60',
    ]"
    @click="!disabled && emit('update:modelValue', !modelValue)"
  >
    <span
      :class="[
        'inline-block transform rounded-full bg-white shadow transition-transform',
        knob[size],
        modelValue ? travel[size] : 'translate-x-0.5',
      ]"
    />
  </button>
</template>
