<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import CloseIcon from './icons/CloseIcon.vue';
import ChevronDownIcon from './icons/ChevronDownIcon.vue';

export interface ComboboxOption {
  value: string;
  label: string;
  color?: string; // couleur CSS optionnelle → pastille (ex. valeurs d'un axe couleur)
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: ComboboxOption[];
    placeholder?: string;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
    creatable?: boolean;
    createLabel?: string;
  }>(),
  {
    placeholder: undefined,
    disabled: false,
    size: 'md',
    creatable: true,
    createLabel: 'Créer',
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'create': [value: string];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const isOpen = ref(false);
const search = ref('');
const highlightedIndex = ref(0);

const selectedOption = computed(() => props.options.find((o) => o.value === props.modelValue));
const displayValue = computed(() => selectedOption.value?.label ?? props.modelValue);

const filteredOptions = computed(() => {
  if (!search.value) return props.options;
  const searchLower = search.value.toLowerCase();
  return props.options.filter((o) => o.label.toLowerCase().includes(searchLower));
});

const showCreateOption = computed(() => {
  if (!props.creatable || !search.value.trim()) return false;
  const searchLower = search.value.toLowerCase().trim();
  return !props.options.some((o) => o.label.toLowerCase() === searchLower);
});

function open() {
  if (props.disabled) return;
  isOpen.value = true;
  search.value = '';
  highlightedIndex.value = 0;
  nextTick(() => inputRef.value?.focus());
}

let closeTimeout: ReturnType<typeof setTimeout> | null = null;

function close() {
  // Delay close to allow click events to fire first
  closeTimeout = setTimeout(() => {
    isOpen.value = false;
    search.value = '';
  }, 150);
}

function closeImmediate() {
  if (closeTimeout) clearTimeout(closeTimeout);
  isOpen.value = false;
  search.value = '';
}

function selectOption(option: ComboboxOption) {
  if (closeTimeout) clearTimeout(closeTimeout);
  emit('update:modelValue', option.value);
  closeImmediate();
}

function createNew() {
  if (closeTimeout) clearTimeout(closeTimeout);
  const value = search.value.trim();
  if (!value) return;
  emit('create', value);
  closeImmediate();
}

function clear(e: Event) {
  e.stopPropagation();
  emit('update:modelValue', '');
}

function handleKeydown(e: KeyboardEvent) {
  const totalOptions = filteredOptions.value.length + (showCreateOption.value ? 1 : 0);

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      highlightedIndex.value = (highlightedIndex.value + 1) % totalOptions;
      break;
    case 'ArrowUp':
      e.preventDefault();
      highlightedIndex.value = (highlightedIndex.value - 1 + totalOptions) % totalOptions;
      break;
    case 'Enter':
      e.preventDefault();
      if (highlightedIndex.value < filteredOptions.value.length) {
        selectOption(filteredOptions.value[highlightedIndex.value]);
      } else if (showCreateOption.value) {
        createNew();
      }
      break;
    case 'Escape':
      closeImmediate();
      break;
  }
}

watch(search, () => {
  highlightedIndex.value = 0;
});

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-2.5 py-1.5 text-sm',
  lg: 'px-3 py-2 text-base',
};
</script>

<template>
  <div class="relative">
    <!-- Trigger -->
    <div
      :class="[
        'w-full border border-gray-300 rounded bg-white flex items-center justify-between cursor-pointer transition',
        sizeClasses[size],
        disabled && 'bg-gray-100 cursor-not-allowed opacity-60',
        isOpen && 'ring-2 ring-blue-500 border-transparent',
      ]"
      @click="open"
    >
      <span
        class="flex items-center gap-2 min-w-0"
        :class="modelValue ? 'text-gray-900' : 'text-gray-400'"
      >
        <span
          v-if="selectedOption?.color"
          class="inline-block w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0"
          :style="{ backgroundColor: selectedOption.color }"
        />
        <span class="truncate">{{ modelValue ? displayValue : placeholder }}</span>
      </span>
      <div class="flex items-center gap-1 -mr-1">
        <button
          v-if="modelValue && !disabled"
          type="button"
          class="p-0.5 text-gray-400 hover:text-gray-600"
          @click="clear"
        >
          <CloseIcon class="w-3.5 h-3.5" />
        </button>
        <ChevronDownIcon
          :class="['w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180']"
        />
      </div>
    </div>

    <!-- Dropdown -->
    <div
      v-if="isOpen"
      class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
    >
      <!-- Search input -->
      <div class="p-2 border-b border-gray-100">
        <input
          ref="inputRef"
          v-model="search"
          type="text"
          :placeholder="placeholder ?? 'Rechercher...'"
          class="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          @keydown="handleKeydown"
          @blur="close"
        />
      </div>

      <!-- Options list -->
      <ul class="max-h-48 overflow-auto">
        <li
          v-for="(option, index) in filteredOptions"
          :key="option.value"
          :class="[
            'px-3 py-2 cursor-pointer text-sm flex items-center gap-2',
            highlightedIndex === index
              ? 'bg-blue-50 text-blue-700'
              : 'hover:bg-gray-50',
            option.value === modelValue && 'font-medium',
          ]"
          @mousedown.prevent="selectOption(option)"
        >
          <span
            v-if="option.color"
            class="inline-block w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0"
            :style="{ backgroundColor: option.color }"
          />
          {{ option.label }}
        </li>

        <!-- Create option -->
        <li
          v-if="showCreateOption"
          :class="[
            'px-3 py-2 cursor-pointer text-sm flex items-center gap-2',
            highlightedIndex === filteredOptions.length
              ? 'bg-blue-50 text-blue-700'
              : 'hover:bg-gray-50 text-gray-600',
          ]"
          @mousedown.prevent="createNew"
        >
          <span class="text-blue-600 font-medium">+</span>
          {{ createLabel }} "{{ search.trim() }}"
        </li>

        <!-- Empty state -->
        <li
          v-if="filteredOptions.length === 0 && !showCreateOption"
          class="px-3 py-2 text-sm text-gray-400"
        >
          Aucun résultat
        </li>
      </ul>
    </div>

    <!-- Backdrop -->
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40"
      @click="closeImmediate"
    />
  </div>
</template>
