<script setup lang="ts">
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

withDefaults(
  defineProps<{
    modelValue: string;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  {
    placeholder: undefined,
    disabled: false,
    size: 'md',
  }
);

defineEmits<{
  'update:modelValue': [value: string];
}>();

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-2.5 py-1.5 text-sm',
  lg: 'px-3 py-2 text-base',
};
</script>

<template>
  <select
    :value="modelValue"
    :disabled="disabled"
    :class="[
      'w-full border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition appearance-none cursor-pointer',
      sizeClasses[size],
      disabled && 'bg-gray-100 cursor-not-allowed opacity-60'
    ]"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option
      v-if="placeholder"
      value=""
      disabled
    >
      {{ placeholder }}
    </option>
    <option
      v-for="opt in options"
      :key="opt.value"
      :value="opt.value"
      :disabled="opt.disabled"
    >
      {{ opt.label }}
    </option>
  </select>
</template>
