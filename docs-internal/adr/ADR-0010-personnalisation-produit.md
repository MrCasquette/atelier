# ADR-0010 — Personnalisation produit (champs déclarés, optionnelle par produit)

Statut : accepté · 2026-07-18
Portée : échoppe

## Contexte

Besoin storefront DPC (B2) : proposer une **personnalisation** payante d'un produit (ex. gravure d'un
« prénom » +5 €). Sur Shopify, c'était un **hack** (un produit-addon ajouté à la commande). Le pipeline
Échoppe dérive tout prix de `variant.priceHt` et ne porte **ni texte libre ni modificateur de prix** sur
la ligne (panier `unique(cart, variant)`, `order_item` snapshote label/prix depuis la variante).

## Options envisagées

- **Variante dédiée** (+5 € en variante) — réutilise le pipeline sans migration, mais **ne stocke pas
  le texte saisi** (le prénom). Insuffisant seul → c'est le hack.
- **`properties` jsonb libres sur la ligne** — sac clé/valeur rempli par le front. Le back ne connaît
  pas les champs → **ne valide pas**, et le **prix viendrait du front** (non sûr). Demi-hack.
- **Champs de personnalisation déclarés au catalogue** — première classe, symétrique de
  `option`/`variant`. Le back connaît les champs, valide, et calcule le prix (autoritaire).

## Décision

Concept **« personnalisation produit »** de première classe, **optionnel par produit** (comme les
variantes) :
- `product.personalizationEnabled` (booléen, toggle admin). `false` → aucune personnalisation, rien ne
  change. `true` → le produit déclare des champs.
- Table `personalization_field` (déclaration catalogue) : `product`, `label`, `type` (`text`/`textarea`),
  `required`, `maxLength`, `priceHt` (supplément si rempli), `sortOrder`.
- Ligne (`cart_item`, `order_item`) : `personalization jsonb` = **valeurs saisies uniquement**
  (`{ <fieldId>: "Lucie" }`). `order_item.addonPriceHt` **snapshote** le supplément.
- **Prix autoritaire back** : le supplément est calculé depuis la déclaration (jamais le front). Dérivé
  live au panier (comme `variant.priceHt`), snapshoté à la commande (comme `unitPriceHt`/`label`).
- `unique(cart, variant)` **relâché** : deux personnalisations d'une même variante = deux lignes ; le
  merge auto ne s'applique qu'aux lignes **sans** personnalisation.
- **SDK typé** : le détail produit expose `personalizationEnabled` + `personalizationFields` ; la ligne
  expose ses valeurs + supplément. Le `jsonb` est un **détail de stockage**, pas une surface libre.

## Conséquences

- Migration : colonne `product.personalizationEnabled`, table `personalization_field`, colonnes de ligne,
  drop de `unique(cart, variant)` (merge géré en code).
- Validation à la frontière (requis, `maxLength`) ; erreur métier typée si invalide.
- Admin : toggle « Personnalisation ? » sur le produit → onglet de gestion des champs (symétrie options).
- Extensible (nouveaux `type` de champ) sans re-toucher le modèle.
