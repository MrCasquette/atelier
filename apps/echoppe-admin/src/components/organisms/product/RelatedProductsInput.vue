<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import Input from '@/components/atoms/Input.vue';
import CloseIcon from '@/components/atoms/icons/CloseIcon.vue';
import { type RefOption, useCatalogRef } from '@/composables/content/useCatalogRef';

// Sélecteur multiple ORDONNÉ de produits liés (B8) : recherche serveur, ajout, retrait,
// réordonnancement. Stocke une liste ordonnée d'UUID. Exclut le produit courant (auto-référence).
const model = defineModel<string[]>({ required: true });
const props = defineProps<{ excludeId?: string }>();

const { options, search, resolveLabel } = useCatalogRef('product');

const term = ref('');
const focused = ref(false);
const labels = ref<Record<string, string>>({});

watch(term, (value) => search(value));

// Résout les libellés des UUID sélectionnés (affichage), à la volée.
async function ensureLabels() {
  for (const id of model.value) {
    if (labels.value[id]) continue;
    const name = await resolveLabel(id);
    if (name) labels.value = { ...labels.value, [id]: name };
  }
}
onMounted(() => {
  search('');
  ensureLabels();
});
watch(() => [...model.value], ensureLabels);

// Options proposées : hors produit courant et hors déjà sélectionnés.
const available = computed(() =>
  options.value.filter((o) => o.id !== props.excludeId && !model.value.includes(o.id)),
);

function add(option: RefOption) {
  labels.value = { ...labels.value, [option.id]: option.name };
  model.value = [...model.value, option.id];
  term.value = '';
}

function remove(id: string) {
  model.value = model.value.filter((x) => x !== id);
}

function move(index: number, delta: number) {
  const next = index + delta;
  if (next < 0 || next >= model.value.length) return;
  const arr = [...model.value];
  [arr[index], arr[next]] = [arr[next], arr[index]];
  model.value = arr;
}
</script>

<template>
  <div class="space-y-3">
    <!-- Liste ordonnée des produits liés -->
    <ul
      v-if="model.length > 0"
      class="space-y-1.5"
    >
      <li
        v-for="(id, index) in model"
        :key="id"
        class="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm"
      >
        <span class="text-xs text-gray-400 tabular-nums">{{ index + 1 }}</span>
        <span class="flex-1 truncate">{{ labels[id] ?? '…' }}</span>
        <button
          type="button"
          class="text-gray-400 hover:text-gray-700 disabled:opacity-30"
          :disabled="index === 0"
          aria-label="Monter"
          @click="move(index, -1)"
        >
          ↑
        </button>
        <button
          type="button"
          class="text-gray-400 hover:text-gray-700 disabled:opacity-30"
          :disabled="index === model.length - 1"
          aria-label="Descendre"
          @click="move(index, 1)"
        >
          ↓
        </button>
        <button
          type="button"
          class="text-gray-400 hover:text-red-600"
          aria-label="Retirer"
          @click="remove(id)"
        >
          <CloseIcon class="h-4 w-4" />
        </button>
      </li>
    </ul>
    <p
      v-else
      class="text-xs text-gray-400"
    >
      Aucun produit lié — le storefront retombe sur le voisinage (même catégorie/collection).
    </p>

    <!-- Recherche + ajout -->
    <div class="relative">
      <Input
        v-model="term"
        placeholder="Rechercher un produit à lier…"
        @focus="focused = true"
        @blur="focused = false"
      />
      <ul
        v-if="focused && available.length > 0"
        class="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-gray-200 bg-white shadow-lg"
      >
        <li
          v-for="option in available"
          :key="option.id"
          class="cursor-pointer truncate px-3 py-1.5 text-sm hover:bg-gray-100"
          @mousedown.prevent="add(option)"
        >
          {{ option.name }}
        </li>
      </ul>
    </div>
  </div>
</template>
