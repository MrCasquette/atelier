---
"@echoppe/client": minor
---

Expose l'`id` de la variante par défaut (`defaultVariant.id`) sur les cartes produit
(`GET /products/`, `/categories/:id/products`, `/collections/:id/products`,
`/products/:id/related`). Auparavant seuls `priceHt`/`compareAtPriceHt`/`quantity` étaient
exposés — sans id, un storefront ne peut pas cibler cette variante depuis une carte (ex. wishlist,
ajout panier direct) sans repasser par la fiche produit détaillée.
