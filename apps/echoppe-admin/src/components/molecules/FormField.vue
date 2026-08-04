<script setup lang="ts">
import Input from '@/components/atoms/Input.vue';
import Textarea from '@/components/atoms/Textarea.vue';
import Label from '@/components/atoms/Label.vue';

withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'textarea';
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    rows?: number;
    size?: 'sm' | 'md' | 'lg';
    error?: string;
  }>(),
  {
    type: 'text',
    placeholder: undefined,
    disabled: false,
    required: false,
    rows: 3,
    size: 'md',
    error: undefined,
  }
);

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <div>
    <Label
      :size="size"
      :required="required"
    >{{ label }}</Label>
    <Textarea
      v-if="type === 'textarea'"
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="rows"
      :size="size"
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <Input
      v-else
      :type="type"
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :size="size"
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <p
      v-if="error"
      class="mt-1 text-xs text-red-500"
    >
      {{ error }}
    </p>
  </div>
</template>
