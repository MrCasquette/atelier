# Design — Signal low-stock public (B10)

Détail de la tâche **Signal low-stock public** du [backlog Échoppe](../backlog/echoppe.md). Décision **pré-tranchée**,
à confirmer à la reprise ; impl simple une fois confirmée.

## Contrainte

`lowStockThreshold` est **volontairement masqué** du public (`variantPublicSchema`) —
[ADR-0006](../adr/ADR-0006-visibilite-catalogue.md) : le seuil est une donnée d'exploitation, pas une
info storefront. On ne l'expose donc **jamais** brut.

## Décision (à confirmer)

Exposer un **booléen calculé** `isLowStock = quantity <= lowStockThreshold` sur `variantPublicSchema`,
au lieu du seuil. Le storefront peut alors afficher « plus que quelques exemplaires » sans connaître
le seuil réel ni le stock exact.

## Impl

- Ajouter `isLowStock: boolean` à la projection publique du variant (dérivé, non stocké).
- Ne rien changer au schéma DB (le seuil et la quantité existent déjà).
- Contrat additif → SDK régénéré (`bun run contracts`), pas de rupture.
- Vérif : variant sous le seuil → `isLowStock: true` côté storefront, seuil absent du payload.
