# ADR-0019 — Tags produit (entité gérée + slug, surface storefront)

Statut : accepté · 2026-07-18
Portée : échoppe

## Contexte

Le brief storefront DPC (B3) demande d'étiqueter les produits (« Nouveauté », « Personnalisable »,
« Solde »…) et d'exposer ces étiquettes au storefront (cartes de liste + fiche détail) pour du
filtrage/affichage. Besoin couplé à B2 (un produit personnalisable peut porter un tag dédié).

## Options envisagées

1. **Colonne `tags text[]` sur `product`** — la plus simple, mais pas d'identité canonique : doublons
   de casse/accents, pas de réutilisation, pas de slug stable pour un futur filtrage, renommage
   impossible sans réécrire chaque produit.
2. **Entité `tag` gérée + junction `product_tag`** — un tag = ligne `{ name, slug }`, le `slug` est
   l'identité canonique (dédup, réutilisation, filtrage stable) ; le `name` est le libellé affiché.
3. **Taxonomie hiérarchique (catégories/facettes)** — surdimensionné : les catégories existent déjà
   (`category`), les tags visent l'étiquetage libre transverse.

## Décision

**Option 2.** Tables `tag` (`name`, `slug` unique) + `product_tag` (PK `product`+`tag`, cascade).

- **Surface storefront** : `tags: string[]` = **noms**, triés **locale-aware FR** (`localeCompare`,
  indépendant de la collation Postgres), exposés sur les cartes (`enrichProductCards`) et le détail
  (`by-slug`, `/:id`). Vide si aucun.
- **Écriture admin** : sémantique **set** — le corps produit (POST create / PUT / PATCH) accepte
  `tags?: string[]` (noms) ; `setProductTags` upsert par slug (le slug réutilise/resynchronise le
  libellé) puis remplace intégralement la junction. Absent = inchangé.
- **Slug interne** : dérivé via `slugify` (`@echoppe/shared`), non exposé au storefront en B3 — il
  reste l'identité canonique pour un futur filtrage `?tag=<slug>` (hors périmètre B3).

## Conséquences

- Migration `0008_quick_smiling_tiger.sql` (tables `tag` + `product_tag`).
- SDK figé régénéré : `tags` ajouté à `ProductList` / `ProductDetail` / `ProductWithVariants`.
- Vue admin `/full` renvoie `tags` (chargement formulaire) ; input à puces `TagsInput` (molecule).
- Dette assumée : pas d'écran de gestion globale des tags (renommage/fusion transverse), pas
  d'endpoint de filtrage par tag ni de listing des tags — à ouvrir si un besoin réel émerge.
- Verrou test : `product-tags.test.ts` (détail trié, carte liste, remplacement set, dédup par slug).
