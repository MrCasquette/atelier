<script setup lang="ts">
import Badge from '@/components/atoms/Badge.vue';
import Button from '@/components/atoms/Button.vue';
import ConfirmModal from '@/components/atoms/ConfirmModal.vue';
import Input from '@/components/atoms/Input.vue';
import Label from '@/components/atoms/Label.vue';
import Modal from '@/components/atoms/Modal.vue';
import Select from '@/components/atoms/Select.vue';
import ColorPicker from '@/components/molecules/ColorPicker.vue';
import {
  type AxisWithValues,
  type ColorMetadata,
  type OptionValue,
  useOptionsCatalog,
} from '@/composables/options/useOptionsCatalog';
import { onMounted, ref } from 'vue';

const catalog = useOptionsCatalog();

const typeOptions = [
  { value: 'string', label: 'Texte' },
  { value: 'color', label: 'Couleur' },
];
const DEFAULT_COLOR: ColorMetadata = { l: 0.7, c: 0.12, h: 30, alpha: 1 };

// --- Édition d'axe (création + renommage/type) ---
const axisModal = ref<{ open: boolean; editingId: string | null; name: string; type: string }>({
  open: false,
  editingId: null,
  name: '',
  type: 'string',
});

function openCreateAxis() {
  axisModal.value = { open: true, editingId: null, name: '', type: 'string' };
}
function openEditAxis(axis: AxisWithValues) {
  axisModal.value = { open: true, editingId: axis.id, name: axis.name, type: axis.type };
}
async function submitAxis() {
  const name = axisModal.value.name.trim();
  if (!name) return;
  const type = axisModal.value.type === 'color' ? 'color' : 'string';
  const ok = axisModal.value.editingId
    ? await catalog.updateAxis(axisModal.value.editingId, { name, type })
    : await catalog.createAxis(name, type);
  if (ok) axisModal.value.open = false;
}

// --- Édition de valeur (label + couleur si axe color) ---
const valueModal = ref<{
  open: boolean;
  axisId: string;
  isColor: boolean;
  editingId: string | null;
  label: string;
  color: ColorMetadata;
}>({ open: false, axisId: '', isColor: false, editingId: null, label: '', color: { ...DEFAULT_COLOR } });

function openAddValue(axis: AxisWithValues) {
  valueModal.value = {
    open: true,
    axisId: axis.id,
    isColor: axis.type === 'color',
    editingId: null,
    label: '',
    color: { ...DEFAULT_COLOR },
  };
}
function openEditValue(axis: AxisWithValues, value: OptionValue) {
  valueModal.value = {
    open: true,
    axisId: axis.id,
    isColor: axis.type === 'color',
    editingId: value.id,
    label: value.value,
    color: value.metadata ?? { ...DEFAULT_COLOR },
  };
}
async function submitValue() {
  const label = valueModal.value.label.trim();
  if (!label) return;
  const metadata = valueModal.value.isColor ? valueModal.value.color : undefined;
  const ok = valueModal.value.editingId
    ? await catalog.updateValue(valueModal.value.axisId, valueModal.value.editingId, {
        value: label,
        metadata: valueModal.value.isColor ? valueModal.value.color : null,
      })
    : await catalog.addValue(valueModal.value.axisId, label, metadata);
  if (ok) valueModal.value.open = false;
}

// --- Suppressions (avec confirmation) ---
const axisToDelete = ref<AxisWithValues | null>(null);
const valueToDelete = ref<{ axisId: string; valueId: string; label: string } | null>(null);

async function doDeleteAxis() {
  if (axisToDelete.value) await catalog.deleteAxis(axisToDelete.value.id);
  axisToDelete.value = null;
}
async function doDeleteValue() {
  if (valueToDelete.value) {
    await catalog.deleteValue(valueToDelete.value.axisId, valueToDelete.value.valueId);
  }
  valueToDelete.value = null;
}

function colorCss(metadata: ColorMetadata | null): string {
  if (!metadata) return 'transparent';
  return `oklch(${metadata.l} ${metadata.c} ${metadata.h} / ${metadata.alpha})`;
}

onMounted(catalog.load);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <p class="text-sm text-gray-500">
        Axes de variantes réutilisables (couleur, taille…) et leurs valeurs prédéfinies.
      </p>
      <Button
        variant="primary"
        @click="openCreateAxis"
      >
        Nouvel axe
      </Button>
    </div>

    <div
      v-if="catalog.loading.value"
      class="text-sm text-gray-400 py-8 text-center"
    >
      Chargement…
    </div>
    <div
      v-else-if="catalog.axes.value.length === 0"
      class="text-sm text-gray-400 py-8 text-center border border-dashed border-gray-200 rounded-lg"
    >
      Aucun axe. Créez-en un pour commencer.
    </div>

    <div
      v-else
      class="space-y-4"
    >
      <div
        v-for="axis in catalog.axes.value"
        :key="axis.id"
        class="border border-gray-200 rounded-lg p-4"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-900">{{ axis.name }}</span>
            <Badge :variant="axis.type === 'color' ? 'info' : 'default'">
              {{ axis.type === 'color' ? 'Couleur' : 'Texte' }}
            </Badge>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="text-sm text-gray-500 hover:text-gray-800 cursor-pointer"
              @click="openEditAxis(axis)"
            >
              Modifier
            </button>
            <button
              type="button"
              class="text-sm text-red-500 hover:text-red-700 cursor-pointer"
              @click="axisToDelete = axis"
            >
              Supprimer
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="value in axis.values"
            :key="value.id"
            type="button"
            class="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full border border-gray-200 text-sm text-gray-700 hover:border-gray-300 cursor-pointer"
            @click="openEditValue(axis, value)"
          >
            <span
              v-if="axis.type === 'color'"
              class="w-4 h-4 rounded-full border border-gray-300 shrink-0"
              :style="{ backgroundColor: colorCss(value.metadata) }"
            />
            {{ value.value }}
          </button>
          <button
            type="button"
            class="text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer px-2 py-1"
            @click="openAddValue(axis)"
          >
            + Valeur
          </button>
        </div>
      </div>
    </div>

    <!-- Modale axe -->
    <Modal
      v-if="axisModal.open"
      :title="axisModal.editingId ? 'Modifier l’axe' : 'Nouvel axe'"
      @close="axisModal.open = false"
    >
      <div class="space-y-4">
        <div>
          <Label required>Nom</Label>
          <Input
            v-model="axisModal.name"
            placeholder="Couleur, Taille…"
            size="lg"
          />
        </div>
        <div>
          <Label>Type</Label>
          <Select
            v-model="axisModal.type"
            :options="typeOptions"
            size="lg"
          />
          <p
            v-if="axisModal.editingId && axisModal.type === 'string'"
            class="mt-1 text-xs text-amber-600"
          >
            Repasser en « Texte » effacera les couleurs des valeurs existantes.
          </p>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button
            variant="ghost"
            @click="axisModal.open = false"
          >
            Annuler
          </Button>
          <Button
            variant="primary"
            @click="submitAxis"
          >
            {{ axisModal.editingId ? 'Enregistrer' : 'Créer' }}
          </Button>
        </div>
      </template>
    </Modal>

    <!-- Modale valeur -->
    <Modal
      v-if="valueModal.open"
      :title="valueModal.editingId ? 'Modifier la valeur' : 'Nouvelle valeur'"
      @close="valueModal.open = false"
    >
      <div class="space-y-4">
        <div>
          <Label required>Libellé</Label>
          <Input
            v-model="valueModal.label"
            placeholder="Rouge, M, XL…"
            size="lg"
          />
        </div>
        <div v-if="valueModal.isColor">
          <Label>Couleur</Label>
          <ColorPicker v-model="valueModal.color" />
        </div>
      </div>
      <template #footer>
        <div class="flex items-center justify-between gap-3">
          <button
            v-if="valueModal.editingId"
            type="button"
            class="text-sm text-red-500 hover:text-red-700 cursor-pointer"
            @click="
              valueToDelete = {
                axisId: valueModal.axisId,
                valueId: valueModal.editingId,
                label: valueModal.label,
              };
              valueModal.open = false;
            "
          >
            Supprimer
          </button>
          <div class="flex justify-end gap-3 ml-auto">
            <Button
              variant="ghost"
              @click="valueModal.open = false"
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              @click="submitValue"
            >
              {{ valueModal.editingId ? 'Enregistrer' : 'Ajouter' }}
            </Button>
          </div>
        </div>
      </template>
    </Modal>

    <ConfirmModal
      :open="!!axisToDelete"
      title="Supprimer l’axe"
      :message="`Supprimer l’axe « ${axisToDelete?.name} » ? Refusé s’il est utilisé par des variantes.`"
      confirm-label="Supprimer"
      @confirm="doDeleteAxis"
      @cancel="axisToDelete = null"
    />
    <ConfirmModal
      :open="!!valueToDelete"
      title="Supprimer la valeur"
      :message="`Supprimer « ${valueToDelete?.label} » ? Refusé si une variante l’utilise.`"
      confirm-label="Supprimer"
      @confirm="doDeleteValue"
      @cancel="valueToDelete = null"
    />
  </div>
</template>
