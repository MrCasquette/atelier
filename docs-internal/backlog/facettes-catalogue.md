# Design — Facettes catalogue (endpoints scopés)

Détail de la tâche **Facettes catalogue** du [backlog Échoppe](../backlog/echoppe.md). Note de travail (pas encore
une décision actée : pas d'ADR tant que le périmètre V1 n'est pas tranché).

## État

Le tri **est livré** (B4) : `GET /{categories,collections}/{id}/products` délègue à
`queryProductCards` et expose `sort = dateCreated | name | price` + `order`. Restent les **facettes**
(filtrage), aujourd'hui absentes des endpoints scopés — c'est une **dépendance framework** : une
boutique ne peut pas contourner ce manque côté client.

## Paliers (par dépendance croissante)

1. **Facettes simples** — fourchette de prix (`minPrice` / `maxPrice`) + `inStock`. Le filtre prix
   réutilise la jointure au variant par défaut (`variant.priceHt` où `isDefault`) déjà en place pour
   le tri prix. Sans agrégation. **Palier de déblocage minimal.**
2. **Facettes par option** — filtrer par valeurs d'option (couleur, taille…) **avec agrégation** des
   facettes disponibles + compteurs (jointures `variantOptionValue`). Gros chantier ; dépend du
   système d'options typées (axes filtrables connus via `/option-axes`).

## Décision en attente

Périmètre V1 : **tri seul** (fait) vs **+ prix/stock** (palier 1) vs **facettes complètes** (palier 2).
Trancher avant d'ouvrir l'impl → à ce moment, acter en ADR si la forme d'API est structurante.

## Ancrage

Toute évolution du payload de carte passe par `apps/echoppe-api/src/modules/catalog/product/card.ts`
(`enrichProductCards`) et la logique partagée `queryProductCards` — jamais dupliquée ×3.
