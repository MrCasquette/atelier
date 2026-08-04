<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import Button from '@/components/atoms/Button.vue';
import IconButton from '@/components/atoms/IconButton.vue';
import Input from '@/components/atoms/Input.vue';
import DynamicForm from './DynamicForm.vue';
import { emptyData, registryKey } from '@/composables/content/registry';
import type { EditorBlock, Registry } from '@/composables/content/types';

// Éditeur de zone dynamique : ordonne les sections d'une page. Palette d'ajout (sections du
// registre), et par bloc un DynamicForm généré depuis sa définition. Opérations immuables sur le
// v-model. Le registre est fourni aux descendants (résolution des component/list imbriqués).
const props = defineProps<{
  registry: Registry;
}>();

const blocks = defineModel<EditorBlock[]>({ required: true });

provide(registryKey, props.registry);

const paletteOpen = ref(false);
const collapsed = ref<Set<string>>(new Set());

const sectionEntries = computed(() =>
  Object.entries(props.registry.sections).map(([name, def]) => ({
    name,
    label: def.label ?? name,
    icon: def.icon,
  })),
);

const blockDef = (type: string) => props.registry.sections[type];

function toggleCollapse(key: string) {
  const next = new Set(collapsed.value);
  next.has(key) ? next.delete(key) : next.add(key);
  collapsed.value = next;
}

function addSection(type: string) {
  const def = blockDef(type);
  if (!def) return;
  blocks.value = [
    ...blocks.value,
    { key: crypto.randomUUID(), id: null, name: null, type, data: emptyData(def, props.registry) },
  ];
  paletteOpen.value = false;
}

function patchBlock(index: number, patch: Partial<EditorBlock>) {
  const next = blocks.value.slice();
  next[index] = { ...next[index], ...patch };
  blocks.value = next;
}

function removeBlock(index: number) {
  blocks.value = blocks.value.filter((_, i) => i !== index);
}

function move(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= blocks.value.length) return;
  const next = blocks.value.slice();
  [next[index], next[target]] = [next[target], next[index]];
  blocks.value = next;
}
</script>

<template>
  <div class="space-y-4">
    <p
      v-if="blocks.length === 0"
      class="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400"
    >
      Aucune section. Ajoutez-en une pour composer la page.
    </p>

    <div
      v-for="(block, index) in blocks"
      :key="block.key"
      class="rounded-lg border border-gray-200 bg-white"
    >
      <!-- En-tête du bloc -->
      <div class="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        <span
          v-if="blockDef(block.type)?.icon"
          class="text-gray-400"
        >
          {{ blockDef(block.type)?.icon }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-gray-800">
            {{ blockDef(block.type)?.label ?? block.type }}
          </p>
        </div>
        <Input
          :model-value="block.name ?? ''"
          placeholder="Libellé interne (optionnel)"
          size="sm"
          class="max-w-48"
          @update:model-value="patchBlock(index, { name: $event || null })"
        />
        <div class="flex items-center gap-1">
          <IconButton
            aria-label="Monter"
            :disabled="index === 0"
            @click="move(index, -1)"
          >
            ↑
          </IconButton>
          <IconButton
            aria-label="Descendre"
            :disabled="index === blocks.length - 1"
            @click="move(index, 1)"
          >
            ↓
          </IconButton>
          <IconButton
            :aria-label="collapsed.has(block.key) ? 'Déplier' : 'Replier'"
            @click="toggleCollapse(block.key)"
          >
            {{ collapsed.has(block.key) ? '▸' : '▾' }}
          </IconButton>
          <IconButton
            variant="danger"
            aria-label="Supprimer"
            @click="removeBlock(index)"
          >
            ✕
          </IconButton>
        </div>
      </div>

      <!-- Corps : formulaire généré -->
      <div
        v-if="!collapsed.has(block.key)"
        class="p-4"
      >
        <DynamicForm
          v-if="blockDef(block.type)"
          :fields="blockDef(block.type)?.fields ?? {}"
          :model-value="block.data"
          @update:model-value="patchBlock(index, { data: $event })"
        />
        <p
          v-else
          class="text-sm text-red-500"
        >
          Type de section « {{ block.type }} » absent du registre.
        </p>
      </div>
    </div>

    <!-- Palette d'ajout -->
    <div class="relative">
      <Button
        variant="secondary"
        @click="paletteOpen = !paletteOpen"
      >
        + Ajouter une section
      </Button>
      <div
        v-if="paletteOpen"
        class="absolute z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      >
        <p
          v-if="sectionEntries.length === 0"
          class="px-3 py-2 text-sm text-gray-400"
        >
          Aucune section dans le registre.
        </p>
        <button
          v-for="entry in sectionEntries"
          :key="entry.name"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
          @click="addSection(entry.name)"
        >
          <span
            v-if="entry.icon"
            class="text-gray-400"
          >{{ entry.icon }}</span>
          {{ entry.label }}
        </button>
      </div>
    </div>
  </div>
</template>
