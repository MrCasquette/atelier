<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import Modal from '@/components/atoms/Modal.vue';
import Button from '@/components/atoms/Button.vue';
import Label from '@/components/atoms/Label.vue';
import Select from '@/components/atoms/Select.vue';
import Input from '@/components/atoms/Input.vue';
import Toggle from '@/components/atoms/Toggle.vue';
import Combobox from '@/components/atoms/Combobox.vue';
import type { ComboboxOption } from '@/components/atoms/Combobox.vue';
import CheckIcon from '@/components/atoms/icons/CheckIcon.vue';
import ColorPicker from '@/components/molecules/ColorPicker.vue';
import type { ColorMetadata } from '@/composables/options/useOptionsCatalog';
import { api } from '@/lib/api';
import { createOptionValue, getOptionValues, updateVariantOptions } from '@/lib/product-api';
import { buildVariantPayload } from '@/composables/product/variant-payload';
import { type Media, getMediaUrl } from '@/composables/media';
import type {
  GlobalOption,
  ProductMedia,
  Option,
  Variant as BaseVariant,
  VariantMutation,
} from '@/composables/product';

// Type Variant étendu pour le formulaire (inclut optionValues)
type Variant = BaseVariant & { optionValues?: string[] };

const props = defineProps<{
  productId: string;
  variant?: Variant | null;
  options: Option[];
  productMedia: ProductMedia[];
  mediaCache: Map<string, Media>;
  onClose: () => void;
  onSaved: () => void;
  onOptionsChange: (_options: Option[]) => void;
}>();

const isNew = computed(() => !props.variant);
const saving = ref(false);

// Image sélectionnée pour cette variante
const selectedMediaId = ref<string | null>(null);

// Images disponibles (exclut featured et celles assignées à d'autres variantes)
const availableImages = computed(() => {
  return props.productMedia.filter((pm) => {
    // Exclure les images featured du produit
    if (pm.isFeatured) return false;
    // Exclure les images déjà assignées à d'autres variantes
    if (pm.featuredForVariant && pm.featuredForVariant !== props.variant?.id) return false;
    return true;
  });
});

// Image actuellement assignée à cette variante
const currentVariantMedia = computed(() => {
  if (!props.variant) return null;
  return props.productMedia.find((pm) => pm.featuredForVariant === props.variant?.id) ?? null;
});

// Form data
const form = ref({
  status: 'draft' as 'draft' | 'published' | 'archived',
  quantity: 0,
  costPrice: '',
  priceHt: '',
  compareAtPriceHt: '',
  sku: '',
  barcode: '',
  length: '',
  width: '',
  height: '',
  weight: '',
  isDefault: false,
});

// Options data (for variant)
const variantOptions = ref<{ optionId: string; valueId: string }[]>([]);

// Global options (all available options)
const globalOptions = ref<GlobalOption[]>([]);

// Load global options on mount
onMounted(async () => {
  const { data } = await api.products['option-axes'].get();
  if (data && Array.isArray(data)) {
    globalOptions.value = data;
  }
});

// Options disponibles pour ajout (exclut celles déjà sur le produit)
const availableOptionsForAdd = computed((): ComboboxOption[] => {
  const productOptionIds = new Set(props.options.map((o) => o.id));
  return globalOptions.value
    .filter((go) => !productOptionIds.has(go.id))
    .map((go) => ({ value: go.id, label: go.name }));
});

// Initialize form when variant changes
watch(
  () => props.variant,
  (v) => {
    if (v) {
      form.value = {
        status: v.status,
        quantity: v.quantity,
        costPrice: v.costPrice ?? '',
        priceHt: v.priceHt,
        compareAtPriceHt: v.compareAtPriceHt ?? '',
        sku: v.sku ?? '',
        barcode: v.barcode ?? '',
        length: v.length ?? '',
        width: v.width ?? '',
        height: v.height ?? '',
        weight: v.weight ?? '',
        isDefault: v.isDefault,
      };
      // Initialize variant options from saved values
      if (v.optionValues && v.optionValues.length > 0) {
        variantOptions.value = v.optionValues.map((valueId) => {
          // Find which option this value belongs to
          const opt = props.options.find((o) => o.values.some((val) => val.id === valueId));
          return { optionId: opt?.id ?? '', valueId };
        }).filter((vo) => vo.optionId);
      } else {
        variantOptions.value = [];
      }
      // Initialize selected image
      const variantMedia = props.productMedia.find((pm) => pm.featuredForVariant === v.id);
      selectedMediaId.value = variantMedia?.media ?? null;
    } else {
      form.value = {
        status: 'draft',
        quantity: 0,
        costPrice: '',
        priceHt: '',
        compareAtPriceHt: '',
        sku: '',
        barcode: '',
        length: '',
        width: '',
        height: '',
        weight: '',
        isDefault: false,
      };
      variantOptions.value = [];
      selectedMediaId.value = null;
    }
  },
  { immediate: true }
);

// Computed volume
const volume = computed(() => {
  const l = parseFloat(form.value.length) || 0;
  const w = parseFloat(form.value.width) || 0;
  const h = parseFloat(form.value.height) || 0;
  if (l && w && h) {
    const vol = (l * w * h) / 1000; // cm³ to dm³ (liters)
    return vol.toFixed(2);
  }
  return null;
});

// Status options
const statusOptions = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'published', label: 'Publié' },
  { value: 'archived', label: 'Archivé' },
];

// Option combobox helpers — pastille pour les valeurs d'un axe couleur.
function getOptionComboboxOptions(opt: Option): ComboboxOption[] {
  return opt.values.map((v) => ({
    value: v.id,
    label: v.value,
    color:
      opt.type === 'color' && v.metadata
        ? `oklch(${v.metadata.l} ${v.metadata.c} ${v.metadata.h} / ${v.metadata.alpha})`
        : undefined,
  }));
}

function getSelectedValueForOption(optionId: string): string {
  return variantOptions.value.find((vo) => vo.optionId === optionId)?.valueId ?? '';
}

function setValueForOption(optionId: string, valueId: string) {
  const existing = variantOptions.value.find((vo) => vo.optionId === optionId);
  if (existing) {
    existing.valueId = valueId;
  } else {
    variantOptions.value.push({ optionId, valueId });
  }
}

const DEFAULT_COLOR: ColorMetadata = { l: 0.7, c: 0.12, h: 30, alpha: 1 };
// Brouillon de création d'une valeur couleur (ouvre le picker) : axe + libellé + couleur.
const colorValueDraft = ref<{ optionId: string; label: string; color: ColorMetadata } | null>(null);

// Valeurs créables à la volée : couleur → passe par le picker, texte → création directe.
function handleCreateOptionValue(optionId: string, value: string) {
  const opt = props.options.find((o) => o.id === optionId);
  if (opt?.type === 'color') {
    colorValueDraft.value = { optionId, label: value, color: { ...DEFAULT_COLOR } };
    return;
  }
  void createValue(optionId, value);
}

async function createValue(optionId: string, value: string, metadata?: ColorMetadata) {
  const data = await createOptionValue(props.productId, optionId, value, metadata);
  if (!data) return;
  const updatedOptions = props.options.map((opt) =>
    opt.id === optionId ? { ...opt, values: [...opt.values, data] } : opt,
  );
  props.onOptionsChange(updatedOptions);
  setValueForOption(optionId, data.id);
}

async function submitColorValue() {
  const draft = colorValueDraft.value;
  if (!draft || !draft.label.trim()) return;
  await createValue(draft.optionId, draft.label.trim(), draft.color);
  colorValueDraft.value = null;
}

// New option creation
const showAddOptionCombobox = ref(false);

async function addExistingOption(optionId: string) {
  // Trouve l'option globale pour récupérer ses valeurs
  const globalOpt = globalOptions.value.find((go) => go.id === optionId);
  if (!globalOpt) return;

  // Associe l'option au produit via l'API
  const { data } = await api.products({ id: props.productId })['option-axes'].post({
    name: globalOpt.name,
  });

  if (data && 'id' in data) {
    // Recharge les valeurs de cette option
    const values = await getOptionValues(props.productId, optionId);
    const newOption: Option = { ...data, sortOrder: 0, values };
    props.onOptionsChange([...props.options, newOption]);
    showAddOptionCombobox.value = false;
  }
}

async function save() {
  saving.value = true;

  try {
    // Réponse CRUD = VariantMutation (variant complet SANS optionValues) → pas de cast vers Variant.
    let savedVariant: VariantMutation | null = null;

    if (isNew.value) {
      const { data } = await api
        .products({ id: props.productId })
        .variants.post(buildVariantPayload(form.value));
      if (data && 'id' in data) {
        savedVariant = data;
      }
    } else if (props.variant) {
      // sortOrder préservé depuis la variante éditée (route = remplacement complet).
      const { data } = await api
        .products({ id: props.productId })
        .variants({ variantId: props.variant.id })
        .put(buildVariantPayload(form.value, props.variant.sortOrder));
      if (data && 'id' in data) {
        savedVariant = data;
      }
    }

    // Save option values for the variant
    if (savedVariant) {
      const optionValueIds = variantOptions.value
        .map((vo) => vo.valueId)
        .filter((id) => id);

      await updateVariantOptions(props.productId, savedVariant.id, optionValueIds);

      // Mettre à jour l'image de la variante
      const previousMediaId = currentVariantMedia.value?.media ?? null;

      // Si l'image a changé
      if (selectedMediaId.value !== previousMediaId) {
        // Retirer l'ancienne association si elle existait
        if (previousMediaId) {
          await api.products({ id: props.productId }).media({ mediaId: previousMediaId }).put({
            featuredForVariant: null,
          });
        }
        // Assigner la nouvelle image si sélectionnée
        if (selectedMediaId.value) {
          await api.products({ id: props.productId }).media({ mediaId: selectedMediaId.value }).put({
            featuredForVariant: savedVariant.id,
          });
        }
      }

      props.onSaved();
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Modal
    :title="isNew ? 'Nouvelle variante' : 'Modifier la variante'"
    size="2xl"
    tall
    @close="onClose"
  >
    <div class="space-y-6">
      <!-- Section: Image de la variante -->
      <section v-if="availableImages.length > 0 || selectedMediaId">
        <h3 class="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Image de la variante
        </h3>
        <div
          v-if="availableImages.length === 0 && !selectedMediaId"
          class="text-sm text-gray-500"
        >
          Aucune image disponible. Ajoutez des images dans l'onglet Medias.
        </div>
        <div
          v-else
          class="flex gap-3 flex-wrap"
        >
          <!-- Option: Aucune image -->
          <button
            type="button"
            class="w-20 h-20 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer"
            :class="selectedMediaId === null ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'"
            @click="selectedMediaId = null"
          >
            <span class="text-xs text-gray-400">Aucune</span>
          </button>
          <!-- Images disponibles -->
          <button
            v-for="pm in availableImages"
            :key="pm.media"
            type="button"
            class="w-20 h-20 rounded-lg border-2 overflow-hidden relative transition-all cursor-pointer"
            :class="selectedMediaId === pm.media ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'"
            @click="selectedMediaId = pm.media"
          >
            <img
              v-if="mediaCache.get(pm.media)"
              :src="getMediaUrl(mediaCache.get(pm.media)!)"
              class="w-full h-full object-cover"
              :alt="mediaCache.get(pm.media)?.alt || ''"
            />
            <div
              v-if="selectedMediaId === pm.media"
              class="absolute inset-0 bg-blue-500/20 flex items-center justify-center"
            >
              <CheckIcon class="w-6 h-6 text-blue-600" />
            </div>
          </button>
        </div>
      </section>

      <!-- Section: Infos principales -->
      <section>
        <h3 class="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Infos principales
        </h3>
        <div class="grid grid-cols-2 gap-6">
          <div>
            <Label>Statut</Label>
            <Select
              v-model="form.status"
              :options="statusOptions"
              size="lg"
            />
          </div>
          <div>
            <Label>Stock</Label>
            <input
              v-model.number="form.quantity"
              type="number"
              min="0"
              class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div class="mt-4 flex items-start justify-between gap-4 rounded border border-gray-200 p-3">
          <div>
            <Label>Variante par défaut</Label>
            <p class="text-xs text-gray-500">
              Prix et stock affichés sur la fiche produit et dans le catalogue.
            </p>
          </div>
          <Toggle v-model="form.isDefault" />
        </div>
      </section>

      <!-- Section: Tarification -->
      <section>
        <h3 class="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Tarification
        </h3>
        <div class="grid grid-cols-3 gap-6">
          <div>
            <Label>Coût d'achat</Label>
            <div class="relative">
              <input
                v-model="form.costPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="w-full px-3 py-2 pr-10 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
            </div>
          </div>
          <div>
            <Label required>Prix HT</Label>
            <div class="relative">
              <input
                v-model="form.priceHt"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                class="w-full px-3 py-2 pr-10 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
            </div>
          </div>
          <div>
            <Label>Prix barré</Label>
            <div class="relative">
              <input
                v-model="form.compareAtPriceHt"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="w-full px-3 py-2 pr-10 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section: Références -->
      <section>
        <h3 class="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Références
        </h3>
        <div class="grid grid-cols-2 gap-6">
          <div>
            <Label>SKU</Label>
            <Input
              v-model="form.sku"
              placeholder="ABC-123"
              size="lg"
            />
          </div>
          <div>
            <Label>Code-barres</Label>
            <Input
              v-model="form.barcode"
              placeholder="EAN / UPC"
              size="lg"
            />
          </div>
        </div>
      </section>

      <!-- Section: Dimensions -->
      <section>
        <h3 class="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Dimensions
        </h3>
        <div class="grid grid-cols-4 gap-6">
          <div>
            <Label>Longueur</Label>
            <div class="relative">
              <input
                v-model="form.length"
                type="number"
                step="0.1"
                min="0"
                placeholder="0"
                class="w-full px-3 py-2 pr-12 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">cm</span>
            </div>
          </div>
          <div>
            <Label>Largeur</Label>
            <div class="relative">
              <input
                v-model="form.width"
                type="number"
                step="0.1"
                min="0"
                placeholder="0"
                class="w-full px-3 py-2 pr-12 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">cm</span>
            </div>
          </div>
          <div>
            <Label>Hauteur</Label>
            <div class="relative">
              <input
                v-model="form.height"
                type="number"
                step="0.1"
                min="0"
                placeholder="0"
                class="w-full px-3 py-2 pr-12 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">cm</span>
            </div>
          </div>
          <div>
            <Label>Poids</Label>
            <div class="relative">
              <input
                v-model="form.weight"
                type="number"
                step="0.001"
                min="0"
                placeholder="0"
                class="w-full px-3 py-2 pr-12 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">kg</span>
            </div>
          </div>
        </div>
        <div
          v-if="volume"
          class="mt-2 text-sm text-gray-500"
        >
          Volume calculé : <span class="font-medium">{{ volume }} L</span>
        </div>
      </section>

      <!-- Section: Options -->
      <section>
        <h3 class="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Options
        </h3>

        <!-- Existing options -->
        <div
          v-if="options.length > 0"
          class="space-y-4 mb-4"
        >
          <div
            v-for="opt in options"
            :key="opt.id"
          >
            <Label>
              {{ opt.name }}
              <span
                v-if="opt.type === 'color'"
                class="ml-1 text-xs font-normal text-gray-400"
              >couleur</span>
            </Label>
            <Combobox
              :model-value="getSelectedValueForOption(opt.id)"
              :options="getOptionComboboxOptions(opt)"
              :placeholder="`Sélectionner ${opt.name.toLowerCase()}`"
              size="lg"
              @update:model-value="setValueForOption(opt.id, $event)"
              @create="handleCreateOptionValue(opt.id, $event)"
            />
          </div>
        </div>

        <!-- Add new option -->
        <div
          v-if="showAddOptionCombobox"
          class="flex gap-3 items-end"
        >
          <div class="flex-1">
            <Label>Axe à ajouter</Label>
            <Combobox
              model-value=""
              :options="availableOptionsForAdd"
              :creatable="false"
              placeholder="Sélectionner un axe existant"
              size="lg"
              @update:model-value="addExistingOption($event)"
            />
          </div>
          <button
            type="button"
            class="px-4 py-2 text-gray-600 hover:text-gray-800 cursor-pointer"
            @click="showAddOptionCombobox = false"
          >
            Annuler
          </button>
        </div>
        <button
          v-else
          type="button"
          class="text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
          @click="showAddOptionCombobox = true"
        >
          + Ajouter un axe
        </button>
      </section>

      <!-- Création d'une valeur couleur (via le picker) -->
      <Modal
        v-if="colorValueDraft"
        title="Nouvelle couleur"
        @close="colorValueDraft = null"
      >
        <div class="space-y-4">
          <div>
            <Label required>Libellé</Label>
            <Input
              v-model="colorValueDraft.label"
              placeholder="Rouge, Bleu Océan…"
              size="lg"
            />
          </div>
          <div>
            <Label>Couleur</Label>
            <ColorPicker v-model="colorValueDraft.color" />
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-3">
            <Button
              variant="ghost"
              @click="colorValueDraft = null"
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              @click="submitColorValue"
            >
              Ajouter
            </Button>
          </div>
        </template>
      </Modal>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <Button
          variant="ghost"
          @click="onClose"
        >
          Annuler
        </Button>
        <Button
          variant="primary"
          :loading="saving"
          @click="save"
        >
          {{ isNew ? 'Créer' : 'Enregistrer' }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
