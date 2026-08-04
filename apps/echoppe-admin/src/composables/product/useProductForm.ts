import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/lib/api';
import type {
  Option,
  PersonalizationField,
  Product,
  ProductDetail,
  ProductFormState,
  ProductMedia,
  Variant,
} from './types';
import { type Media } from '@/composables/media';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7532';

interface UseProductFormOptions {
  onProductLoaded?: (product: ProductDetail) => void;
}

interface UseProductFormReturn {
  // Route info
  isNew: ComputedRef<boolean>;
  productId: ComputedRef<string | null>;

  // State
  product: Ref<Product | null>;
  form: Ref<ProductFormState>;
  variants: Ref<Variant[]>;
  options: Ref<Option[]>;
  personalizationFields: Ref<PersonalizationField[]>;
  productMedia: Ref<ProductMedia[]>;
  mediaCache: Ref<Map<string, Media>>;
  variantThumbnails: Ref<Map<string, string>>;
  loading: Ref<boolean>;
  saving: Ref<boolean>;

  // Computed
  hasChanges: ComputedRef<boolean>;
  dateCreated: ComputedRef<string>;
  dateUpdated: ComputedRef<string>;

  // Actions
  loadProduct: () => Promise<void>;
  loadProductMedia: () => Promise<void>;
  reloadPersonalizationFields: () => Promise<void>;
  save: () => Promise<void>;
  initNewProduct: (defaultCategory: string, defaultTaxRate: string) => void;
  goBack: () => void;
}

export function useProductForm(config: UseProductFormOptions = {}): UseProductFormReturn {
  const route = useRoute();
  const router = useRouter();

  // Route info
  const isNew = computed(() => route.params.id === 'new');
  const productId = computed(() => (isNew.value ? null : (route.params.id as string)));

  // State
  const product = ref<Product | null>(null);
  const form = ref<ProductFormState>({
    name: '',
    slug: '',
    description: '',
    category: '',
    taxRate: '',
    collection: '',
    status: 'draft',
    personalizationEnabled: false,
    tags: [],
    relatedProductIds: [],
  });
  const variants = ref<Variant[]>([]);
  const options = ref<Option[]>([]);
  const personalizationFields = ref<PersonalizationField[]>([]);
  const productMedia = ref<ProductMedia[]>([]);
  const mediaCache = ref<Map<string, Media>>(new Map());
  const variantThumbnails = ref<Map<string, string>>(new Map());
  const loading = ref(true);
  const saving = ref(false);

  // Dirty state tracking
  const initialFormState = ref<ProductFormState | null>(null);

  const hasChanges = computed(() => {
    if (!initialFormState.value) return false;
    if (isNew.value && form.value.name.trim()) return true;
    return JSON.stringify(form.value) !== JSON.stringify(initialFormState.value);
  });

  // Date formatters
  const dateCreated = computed(() => {
    if (!product.value?.dateCreated) return '-';
    return new Date(product.value.dateCreated).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  const dateUpdated = computed(() => {
    if (!product.value?.dateUpdated) return '-';
    return new Date(product.value.dateUpdated).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  // Load product media
  async function loadProductMedia() {
    if (!productId.value) return;

    const thumbnails = new Map<string, string>();

    try {
      const { data: productMediaList } = await api.products({ id: productId.value }).media.get();
      if (productMediaList) {
        productMedia.value = productMediaList;

        for (const pm of productMediaList) {
          if (!mediaCache.value.has(pm.media)) {
            const { data: mediaData } = await api.media({ id: pm.media }).get();
            if (mediaData && 'id' in mediaData) {
              mediaCache.value.set(pm.media, mediaData as Media);
            }
          }
          if (pm.featuredForVariant) {
            thumbnails.set(pm.featuredForVariant, `${API_URL}/assets/${pm.media}`);
          }
        }
      }
    } catch {
      // Ignore errors
    }

    variantThumbnails.value = thumbnails;
  }

  // Load product
  async function loadProduct() {
    if (!productId.value) return;

    // Lecture ADMIN complète (variants avec costPrice/lowStockThreshold).
    const { data } = await api.products({ id: productId.value }).full.get();
    if (data && 'id' in data) {
      product.value = data;
      const formData: ProductFormState = {
        name: data.name,
        slug: data.slug,
        description: data.description || '',
        category: data.category,
        taxRate: data.taxRate,
        collection: '',
        status: data.status,
        personalizationEnabled: data.personalizationEnabled ?? false,
        tags: Array.isArray(data.tags) ? [...data.tags] : [],
        relatedProductIds:
          'relatedProductIds' in data && Array.isArray(data.relatedProductIds)
            ? [...data.relatedProductIds]
            : [],
      };
      form.value = formData;
      initialFormState.value = { ...formData };

      if ('variants' in data && Array.isArray(data.variants)) {
        variants.value = data.variants;
      }
      if ('options' in data && Array.isArray(data.options)) {
        options.value = data.options;
      }
      if ('personalizationFields' in data && Array.isArray(data.personalizationFields)) {
        personalizationFields.value = data.personalizationFields;
      }

      await loadProductMedia();
      config.onProductLoaded?.(data as ProductDetail);
    }
  }

  // Recharge UNIQUEMENT les champs de personnalisation (sans toucher au form) — après un CRUD de
  // champ, pour ne pas écraser l'état du toggle non encore enregistré.
  async function reloadPersonalizationFields() {
    if (!productId.value) return;
    const { data } = await api.products({ id: productId.value }).full.get();
    if (data && 'personalizationFields' in data && Array.isArray(data.personalizationFields)) {
      personalizationFields.value = data.personalizationFields;
    }
  }

  // Initialize new product
  function initNewProduct(defaultCategory: string, defaultTaxRate: string) {
    form.value.category = defaultCategory;
    form.value.taxRate = defaultTaxRate;
    initialFormState.value = { ...form.value };
  }

  // Save product
  async function save() {
    saving.value = true;

    const payload = {
      name: form.value.name,
      description: form.value.description || undefined,
      category: form.value.category,
      taxRate: form.value.taxRate,
      status: form.value.status,
      personalizationEnabled: form.value.personalizationEnabled,
      tags: form.value.tags,
      relatedProductIds: form.value.relatedProductIds,
    };

    try {
      if (isNew.value) {
        const { data } = await api.products.post(payload);
        if (data && 'id' in data) {
          product.value = data;
          form.value.slug = data.slug;
          router.replace(`/produits/${data.id}`);
        }
      } else if (productId.value) {
        await api.products({ id: productId.value }).put(payload);
        await loadProduct();
      }
    } finally {
      saving.value = false;
    }
  }

  // Navigation
  function goBack() {
    router.push('/produits');
  }

  return {
    // Route info
    isNew,
    productId,

    // State
    product,
    form,
    variants,
    options,
    personalizationFields,
    productMedia,
    mediaCache,
    variantThumbnails,
    loading,
    saving,

    // Computed
    hasChanges,
    dateCreated,
    dateUpdated,

    // Actions
    loadProduct,
    loadProductMedia,
    reloadPersonalizationFields,
    save,
    initNewProduct,
    goBack,
  };
}
