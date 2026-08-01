# ADR-0009 — Variante par défaut (exclusivité + fallback publié) & `featuredImage`

Statut : accepté · 2026-07-18 · commit `f736468`
Portée : échoppe

## Contexte

La « variante par défaut » d'un produit porte le prix/stock affichés sur la carte et la fiche. Trois
défauts vécus côté boutique (brief DPC) : (A1) rattacher une image de variante en admin réinitialisait
`isDefault`/`sortOrder` ; (A2) l'admin n'exposait aucun contrôle `isDefault` → produit sans défaut
irrécupérable ; (A3) une carte sans variante `isDefault` renvoyait `defaultVariant: null` → **faux
out-of-stock**. Besoin storefront (B1) : exposer l'image propre à chaque variante.

## Options envisagées

- **Fallback `defaultVariant`** : toutes variantes vs **publiées uniquement** ; 1re par `sortOrder`.
- **Unicité `isDefault`** : garantie UI seule vs **exclusivité côté API** (transaction).
- **`featuredImage` par variante** : schéma dédié `by-slug` vs **ajout au `variantDetailSchema`
  partagé** (`by-slug` + `/:id`).

## Décision

- **Fallback publié** : `defaultVariant` = variante `isDefault=true`, sinon **1re variante publiée**
  par `sortOrder` (helper `selectDefaultVariants`, `SELECT DISTINCT ON`, `status='published'`),
  partagé par l'enrichissement des cartes **et** les filtres/tri prix.
- **Exclusivité côté API** : cocher `isDefault` (POST/PUT variant) décoche les autres variantes du
  produit dans une **transaction**. Le `VariantModal` propage `isDefault`/`sortOrder` (la route PUT
  est un remplacement complet) + toggle « variante par défaut ».
- **`featuredImage: string|null`** ajouté au `variantDetailSchema` partagé, sourcé du média
  `featuredForVariant` ; peuplé sur `by-slug` et `/:id`. Contrat SDK figé régénéré.

## Conséquences

- Un produit avec ≥1 variante publiée n'a plus jamais de `defaultVariant` vide (anti faux-OOS).
- Verrouillé par test (`apps/api/tests/variant-default-image.test.ts` : A3 ×4 + B1) — cf. Phase 3.
- L'exclusivité `isDefault` (A2) reste validée e2e manuellement + par test API (session injectée).
