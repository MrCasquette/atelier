import { asc, db, eq, inArray, personalizationField } from '@echoppe/core';

// Domaine « personnalisation produit » (ADR-0010). La DÉCLARATION vit au catalogue
// (personalization_field) ; les VALEURS saisies vivent sur la ligne (cart_item/order_item). Le prix
// du supplément est AUTORITAIRE côté back : jamais fixé par le client. Ce module centralise la
// lecture des champs et la validation/pricing (pure) partagées par le panier et le checkout.

export interface PersonalizationFieldRow {
  id: string;
  label: string;
  type: 'text' | 'textarea';
  required: boolean;
  maxLength: number | null;
  priceHt: string;
  sortOrder: number;
}

const selectFields = {
  id: personalizationField.id,
  label: personalizationField.label,
  type: personalizationField.type,
  required: personalizationField.required,
  maxLength: personalizationField.maxLength,
  priceHt: personalizationField.priceHt,
  sortOrder: personalizationField.sortOrder,
} as const;

export function getPersonalizationFields(productId: string): Promise<PersonalizationFieldRow[]> {
  return db
    .select(selectFields)
    .from(personalizationField)
    .where(eq(personalizationField.product, productId))
    .orderBy(asc(personalizationField.sortOrder));
}

// Champs par produit pour un lot (lecture panier), regroupés.
export async function getPersonalizationFieldsByProduct(
  productIds: string[],
): Promise<Map<string, PersonalizationFieldRow[]>> {
  const byProduct = new Map<string, PersonalizationFieldRow[]>();
  if (productIds.length === 0) return byProduct;
  const rows = await db
    .select({ ...selectFields, product: personalizationField.product })
    .from(personalizationField)
    .where(inArray(personalizationField.product, productIds))
    .orderBy(asc(personalizationField.sortOrder));
  for (const { product, ...field } of rows) {
    const list = byProduct.get(product) ?? [];
    list.push(field);
    byProduct.set(product, list);
  }
  return byProduct;
}

export interface ResolvedPersonalization {
  error?: string; // erreur métier (validation) → 400 à la frontière
  value: Record<string, string> | null; // { <fieldId>: valeur } normalisé, null si aucune
  addonPriceHt: number; // supplément total (somme des champs remplis)
}

// Valide les valeurs saisies contre la déclaration et calcule le supplément. Pure (pas de DB).
export function resolvePersonalization(
  fields: PersonalizationFieldRow[],
  values: Record<string, string> | null | undefined,
): ResolvedPersonalization {
  const provided = values ?? {};
  const fieldIds = new Set(fields.map((f) => f.id));
  for (const key of Object.keys(provided)) {
    if (!fieldIds.has(key)) {
      return { error: 'Champ de personnalisation inconnu', value: null, addonPriceHt: 0 };
    }
  }

  const result: Record<string, string> = {};
  let addonPriceHt = 0;
  for (const field of fields) {
    const raw = provided[field.id];
    const val = typeof raw === 'string' ? raw.trim() : '';
    if (!val) {
      if (field.required) {
        return { error: `Le champ « ${field.label} » est requis`, value: null, addonPriceHt: 0 };
      }
      continue;
    }
    if (field.maxLength !== null && val.length > field.maxLength) {
      return {
        error: `Le champ « ${field.label} » dépasse ${field.maxLength} caractères`,
        value: null,
        addonPriceHt: 0,
      };
    }
    result[field.id] = val;
    addonPriceHt += parseFloat(field.priceHt);
  }

  return { value: Object.keys(result).length > 0 ? result : null, addonPriceHt };
}

// Supplément d'une ligne déjà validée : somme des priceHt des champs effectivement remplis.
// Primitive de tarification partagée (affichage panier + totaux checkout) — `resolvePersonalization`
// couvre le chemin d'ajout (validation + supplément), celle-ci le chemin de relecture (sans revalider).
export function calculateAddonPrice(
  fields: PersonalizationFieldRow[],
  values: Record<string, string> | null,
): number {
  return fields.filter((f) => values?.[f.id]).reduce((sum, f) => sum + parseFloat(f.priceHt), 0);
}

// Projette la personnalisation stockée ({fieldId: valeur}) en lignes d'affichage ordonnées
// (label + valeur), pour la lecture panier/commande.
export function displayPersonalization(
  fields: PersonalizationFieldRow[],
  value: Record<string, string> | null,
): { fieldId: string; label: string; value: string }[] {
  if (!value) return [];
  return fields
    .filter((f) => value[f.id])
    .map((f) => ({ fieldId: f.id, label: f.label, value: value[f.id] }));
}
