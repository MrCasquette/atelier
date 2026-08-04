<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import Input from '@/components/atoms/Input.vue';
import Modal from '@/components/atoms/Modal.vue';
import { type CatalogTarget, type RefOption, useCatalogRef } from '@/composables/content/useCatalogRef';

// Widget de sélection d'une entité catalogue (produit/collection/catégorie/page) : stocke son UUID,
// affiche le libellé résolu. Utilisé par le champ `ref` de P3 et par les liens de menu.
const props = defineProps<{
  modelValue: string | null;
  to: CatalogTarget;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const { options, loading, search, resolveLabel, targetLabel } = useCatalogRef(props.to);

const isOpen = ref(false);
const term = ref('');
const selectedLabel = ref<string | null>(null);

async function loadLabel() {
  selectedLabel.value = props.modelValue ? await resolveLabel(props.modelValue) : null;
}
onMounted(loadLabel);
watch(() => props.modelValue, loadLabel);

function open() {
  isOpen.value = true;
  term.value = '';
  search('');
}

function choose(option: RefOption) {
  selectedLabel.value = option.name;
  emit('update:modelValue', option.id);
  isOpen.value = false;
}

function clear() {
  selectedLabel.value = null;
  emit('update:modelValue', null);
}

watch(term, (value) => search(value));
</script>

<template>
  <div>
    <!-- Sélection actuelle -->
    <div
      v-if="modelValue"
      class="flex items-center gap-2 rounded border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-sm"
    >
      <span class="flex-1 truncate">
        {{ selectedLabel ?? '…' }}
      </span>
      <button
        type="button"
        class="text-gray-400 hover:text-blue-600"
        @click="open"
      >
        Changer
      </button>
      <button
        type="button"
        class="text-gray-400 hover:text-red-500"
        @click="clear"
      >
        ✕
      </button>
    </div>

    <!-- Vide -->
    <button
      v-else
      type="button"
      class="w-full rounded border border-dashed border-gray-300 px-2.5 py-1.5 text-left text-sm text-gray-400 hover:border-gray-400 hover:text-gray-500"
      @click="open"
    >
      Choisir un·e {{ targetLabel }}
    </button>

    <!-- Modal de recherche -->
    <Modal
      v-if="isOpen"
      :title="`Choisir un·e ${targetLabel}`"
      size="md"
      tall
      @close="isOpen = false"
    >
      <div class="space-y-3">
        <Input
          v-model="term"
          :placeholder="`Rechercher un·e ${targetLabel}…`"
        />
        <p
          v-if="loading"
          class="py-4 text-center text-sm text-gray-400"
        >
          Chargement…
        </p>
        <ul
          v-else-if="options.length > 0"
          class="divide-y divide-gray-100"
        >
          <li
            v-for="option in options"
            :key="option.id"
            class="cursor-pointer px-2 py-2 text-sm hover:bg-blue-50"
            :class="option.id === modelValue && 'bg-blue-50 font-medium'"
            @click="choose(option)"
          >
            {{ option.name }}
          </li>
        </ul>
        <p
          v-else
          class="py-4 text-center text-sm text-gray-400"
        >
          Aucun résultat
        </p>
      </div>
    </Modal>
  </div>
</template>
