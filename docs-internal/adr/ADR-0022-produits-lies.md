# ADR-0022 — Produits liés : curation directionnelle + fallback voisinage

Statut : accepté
Portée : échoppe

## Contexte

Une fiche produit gagne à recommander d'autres produits (« complète le set », cross-sell). Deux
approches : un calcul **automatique** par voisinage (même catégorie/collection), ou une **curation**
manuelle par le commerçant. L'artisan connaît ses associations éditoriales (un mug + son sous-verre)
qu'aucun algorithme de voisinage ne devine.

## Options envisagées

- **Auto seul** (`/related` = voisins même catégorie/collection) : zéro gestion, mais aucun contrôle
  éditorial, associations souvent hors-sujet.
- **Curation seule** : contrôle total, mais section vide tant que le commerçant n'a rien lié.
- **Curation directionnelle + fallback voisinage** (retenu).
- Curation **bidirectionnelle** (lier A—B associe les deux sens) : écartée — perd le contrôle de
  l'ordre par fiche et pollue la fiche B sans intention.

## Décision

Relation **directionnelle curée** avec **fallback voisinage** :

- Table `product_related` (`product`, `related_product`, `sort_order`, PK `(product, related_product)`).
  Sur la fiche A, le commerçant choisit et **ordonne** ses produits liés. Asymétrique : A→B n'implique
  pas B→A (chaque fiche décide de sa propre liste).
- Écriture **set** intégrée au produit (comme les tags B3) : `relatedProductIds: string[]` ordonné
  dans le body create/update/patch → `setRelatedProducts` (exclut l'auto-référence, dédoublonne).
- Lecture publique `GET /products/:id/related` → cartes ordonnées des liés **publiés**. Si la
  curation est **vide**, fallback : voisins publiés de la même catégorie OU d'une collection commune,
  hors le produit lui-même, les plus récents d'abord (`getFallbackRelatedIds`). → jamais de section
  vide, mais l'auto ne s'active qu'en l'absence de choix explicite.
- UI admin : `RelatedProductsInput` (recherche serveur via `useCatalogRef('product')`, liste
  ordonnée avec ajout/retrait/réordonnancement).

## Conséquences

- Contrôle éditorial total quand le commerçant le veut, dégradation gracieuse (voisinage) sinon.
- Réutilise la projection unique `enrichProductCards` (cartes cohérentes avec listings/catégories).
- `relatedProductIds` exposé dans la vue admin (`ProductAdminWithVariants`) pour l'édition ; la
  surface storefront n'expose que `/products/:id/related` (cartes), pas les IDs bruts.
- SDK : nouvelle route storefront `products.related(id)` + modèle `RelatedProducts`.
- Verrou : `related-products.test.ts` (ordre curé, exclusion self, fallback voisinage).
