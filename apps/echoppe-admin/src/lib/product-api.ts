/**
 * Helpers pour les routes produit à paramètres dynamiques imbriqués.
 * Types INFÉRÉS d'Eden (pas de shape manuel), appels en notation fonction Eden.
 */
import type { ColorMetadata, GlobalOption, OptionValueItem } from '@/composables/product/types';
import { api } from './api';

/**
 * POST /products/:id/options/:optionId/values — crée une valeur (metadata couleur si type=color).
 */
export async function createOptionValue(
  productId: string,
  optionId: string,
  value: string,
  metadata?: ColorMetadata,
): Promise<OptionValueItem | null> {
  const axis = api.products({ id: productId })['option-axes']({ optionId });
  const { data } = await axis.values.post({ value, metadata });
  return data ?? null;
}

/**
 * PUT /products/:id/options/:optionId/values/:valueId — édite une valeur (value/metadata/sortOrder).
 * `metadata: null` efface la couleur ; absent = inchangé.
 */
export async function updateOptionValue(
  productId: string,
  optionId: string,
  valueId: string,
  patch: { value?: string; metadata?: ColorMetadata | null; sortOrder?: number },
): Promise<OptionValueItem | null> {
  const axis = api.products({ id: productId })['option-axes']({ optionId });
  const { data } = await axis.values({ valueId }).put(patch);
  return data ?? null;
}

/**
 * GET /products/:id/options/:optionId/values — valeurs d'une option.
 */
export async function getOptionValues(
  productId: string,
  optionId: string,
): Promise<OptionValueItem[]> {
  const { data } = await api.products({ id: productId })['option-axes']({ optionId }).values.get();
  return Array.isArray(data) ? data : [];
}

/**
 * PUT /products/:id/options/:optionId — édite une option (name/type/sortOrder).
 */
export async function updateOption(
  productId: string,
  optionId: string,
  patch: { name?: string; type?: GlobalOption['type']; sortOrder?: number },
): Promise<GlobalOption | null> {
  const { data } = await api.products({ id: productId })['option-axes']({ optionId }).put(patch);
  return data ?? null;
}

/**
 * PUT /products/:id/variants/:variantId/options — remplace les valeurs d'options d'une variante.
 */
export async function updateVariantOptions(
  productId: string,
  variantId: string,
  optionValueIds: string[],
): Promise<boolean> {
  const { data } = await api
    .products({ id: productId })
    .variants({ variantId })
    .options.put({ optionValueIds });
  return !!data && 'success' in data && data.success === true;
}
