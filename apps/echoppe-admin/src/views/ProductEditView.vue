<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import ProductMediaGallery from '@/components/organisms/ProductMediaGallery.vue';
import VariantModal from '@/components/organisms/VariantModal.vue';
import ProductHeader from '@/components/organisms/product/ProductHeader.vue';
import ProductInfoCard from '@/components/organisms/product/ProductInfoCard.vue';
import ProductVariantsCard from '@/components/organisms/product/ProductVariantsCard.vue';
import ProductPersonalizationCard from '@/components/organisms/product/ProductPersonalizationCard.vue';
import PersonalizationFieldModal from '@/components/organisms/product/PersonalizationFieldModal.vue';
import ProductSidebar from '@/components/organisms/product/ProductSidebar.vue';
import RelatedProductsInput from '@/components/organisms/product/RelatedProductsInput.vue';
import {
  useProductData,
  useProductForm,
  useProductPersonalization,
  useProductVariants,
} from '@/composables/product';

// Composables
const productData = useProductData();
const productForm = useProductForm();

const productVariants = useProductVariants({
  productId: productForm.productId,
  variants: productForm.variants,
  options: productForm.options,
  variantThumbnails: productForm.variantThumbnails,
  onReload: productForm.loadProduct,
});

const productPersonalization = useProductPersonalization({
  productId: productForm.productId,
  onReload: productForm.reloadPersonalizationFields,
});

// Onglets de l'éditeur (produit existant uniquement — variantes/médias créés après enregistrement).
type EditorTab = 'general' | 'variantes' | 'personnalisation';
const activeTab = ref<EditorTab>('general');
const variantCount = computed(() => productForm.variants.value.length);
const fieldCount = computed(() => productForm.personalizationFields.value.length);

// Handle media changes
async function handleMediaChange() {
  await productForm.loadProductMedia();
}

// Initialize
onMounted(async () => {
  productForm.loading.value = true;
  await productData.loadAll();

  if (!productForm.isNew.value) {
    await productForm.loadProduct();
  } else {
    productForm.initNewProduct(productData.getDefaultCategory(), productData.getDefaultTaxRate());
  }

  productForm.loading.value = false;
});
</script>

<template>
  <div>
    <ProductHeader
      :title="productForm.form.value.name"
      :is-new="productForm.isNew.value"
      :saving="productForm.saving.value"
      :has-changes="productForm.hasChanges.value"
      @back="productForm.goBack"
      @save="productForm.save"
    />

    <div
      v-if="productForm.loading.value"
      class="text-gray-500"
    >
      Chargement...
    </div>

    <!-- Main layout: 2 columns -->
    <div
      v-else
      class="flex gap-6"
    >
      <!-- Left: Main content -->
      <div class="flex-1 min-w-0">
        <!-- Nouveau produit : pas d'onglets (médias/variantes créés après enregistrement) -->
        <ProductInfoCard
          v-if="productForm.isNew.value"
          v-model:name="productForm.form.value.name"
          v-model:description="productForm.form.value.description"
          v-model:tags="productForm.form.value.tags"
        />

        <!-- Produit existant : onglets Général / Variantes -->
        <template v-else>
          <div class="border-b border-gray-200 mb-6">
            <nav class="-mb-px flex gap-6">
              <button
                type="button"
                class="pb-3 text-sm font-medium transition-colors cursor-pointer"
                :class="
                  activeTab === 'general'
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                "
                @click="activeTab = 'general'"
              >
                Général
              </button>
              <button
                type="button"
                class="pb-3 text-sm font-medium transition-colors cursor-pointer"
                :class="
                  activeTab === 'variantes'
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                "
                @click="activeTab = 'variantes'"
              >
                Variantes
                <span class="ml-1 text-xs text-gray-400">{{ variantCount }}</span>
              </button>
              <button
                type="button"
                class="pb-3 text-sm font-medium transition-colors cursor-pointer"
                :class="
                  activeTab === 'personnalisation'
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                "
                @click="activeTab = 'personnalisation'"
              >
                Personnalisation
                <span
                  v-if="productForm.form.value.personalizationEnabled"
                  class="ml-1 text-xs text-gray-400"
                >{{ fieldCount }}</span>
              </button>
            </nav>
          </div>

          <div
            v-show="activeTab === 'general'"
            class="space-y-6"
          >
            <ProductInfoCard
              v-model:name="productForm.form.value.name"
              v-model:description="productForm.form.value.description"
              v-model:tags="productForm.form.value.tags"
            />
            <div class="bg-white rounded-lg shadow p-6">
              <ProductMediaGallery
                v-if="productForm.productId.value"
                :product-id="productForm.productId.value"
                :variants="productForm.variants.value"
                :product-media="productForm.productMedia.value"
                :media-cache="productForm.mediaCache.value"
                @media-change="handleMediaChange"
              />
            </div>
            <div class="bg-white rounded-lg shadow p-6">
              <h3 class="text-sm font-medium text-gray-900 mb-1">Produits liés</h3>
              <p class="text-xs text-gray-500 mb-3">
                Produits recommandés sur la fiche (ordre respecté). Vide = voisinage automatique.
              </p>
              <RelatedProductsInput
                v-model="productForm.form.value.relatedProductIds"
                :exclude-id="productForm.productId.value ?? undefined"
              />
            </div>
          </div>

          <div v-show="activeTab === 'variantes'">
            <ProductVariantsCard
              :variants="productVariants.variantsData.value"
              :columns="productVariants.variantColumns.value"
              :row-id="productVariants.getVariantRowId"
              :on-reorder="productVariants.handleVariantReorder"
              @add="productVariants.handleAddVariant"
            />
          </div>

          <div v-show="activeTab === 'personnalisation'">
            <ProductPersonalizationCard
              v-model:enabled="productForm.form.value.personalizationEnabled"
              :fields="productForm.personalizationFields.value"
              @add="productPersonalization.openFieldModal()"
              @edit="productPersonalization.openFieldModal($event)"
              @remove="productPersonalization.deleteField($event)"
            />
          </div>
        </template>
      </div>

      <!-- Right: Sidebar -->
      <ProductSidebar
        v-model:status="productForm.form.value.status"
        v-model:category="productForm.form.value.category"
        v-model:collection="productForm.form.value.collection"
        v-model:tax-rate="productForm.form.value.taxRate"
        :is-new="productForm.isNew.value"
        :slug="productForm.form.value.slug"
        :date-created="productForm.dateCreated.value"
        :date-updated="productForm.dateUpdated.value"
        :category-options="productData.categoryOptions.value"
        :collection-options="productData.collectionOptions.value"
        :tax-rate-options="productData.taxRateOptions.value"
        :status-options="productData.statusOptions"
      />
    </div>

    <!-- Variant Modal -->
    <VariantModal
      v-if="productVariants.showVariantModal.value && productForm.productId.value"
      :product-id="productForm.productId.value"
      :variant="productVariants.editingVariant.value"
      :options="productForm.options.value"
      :product-media="productForm.productMedia.value"
      :media-cache="productForm.mediaCache.value"
      :on-close="productVariants.closeVariantModal"
      :on-saved="productVariants.onVariantSaved"
      :on-options-change="productVariants.updateOptions"
    />

    <!-- Personalization Field Modal -->
    <PersonalizationFieldModal
      v-if="productPersonalization.showFieldModal.value && productForm.productId.value"
      :product-id="productForm.productId.value"
      :field="productPersonalization.editingField.value"
      :on-close="productPersonalization.closeFieldModal"
      :on-saved="productPersonalization.onFieldSaved"
    />
  </div>
</template>
